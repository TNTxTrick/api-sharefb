const express = require("express");
const axios = require("axios");
require("colors");

const app = express();

app.get("/", (req, res) => {
    res.send("<h1>Facebook Share!</h1><p>tntxtrick</p>");
});

// Cookie trực tiếp trong code
const COOKIE = "sb=7W7-Zrs361QPN5PYjpTVzs48;datr=7W7-Zg2akABlM-ADlV1qDfZn;vpd=v1%3B736x393x2.75;ps_l=1;ps_n=1;locale=vi_VN;m_pixel_ratio=2.75;wd=393x736;c_user=61563608371247;fr=0dQMMga8bVF1zOqpV.AWU3gbR1YOb3qmVMBObNjvM2Wbs.Bm_m7t..AAA.0.0.Bnf7pI.AWWqumafFGA;xs=37%3AJylextEOpmr_Fw%3A2%3A1736424009%3A-1%3A11391;fbl_st=101525056%3BT%3A28940400;wl_cbv=v2%3Bclient_version%3A2710%3Btimestamp%3A1736424015;"; // Thay bằng cookie của bạn

const headers = {
    'authority': 'business.facebook.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'accept-language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': "Windows",
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
};

// Bộ lưu trạng thái và đếm số lần buff mỗi ID
let activeBuffs = new Map(); // Theo dõi ID đang được buff
let dailyBuffCounts = {}; // Lưu số lượng buff mỗi ngày cho từng ID

// Reset số lần buff mỗi ngày
setInterval(() => {
    dailyBuffCounts = {};
    console.log("[ INFO ]: Reset daily buff counts.".brightYellow);
}, 24 * 60 * 60 * 1000); // Reset mỗi 24 giờ

class Share {
    async getToken() {
        try {
            headers["cookie"] = COOKIE; // Thêm cookie trực tiếp
            const response = await axios.get("https://business.facebook.com/content_management", { headers });
            const accessToken = "EAAG" + response.data.split("EAAG")[1].split('","')[0];
            return {
                accessToken,
                cookie: headers["cookie"],
            };
        } catch (err) {
            console.error(`[ ERROR ]: Failed to fetch token`.brightRed, err.message);
            throw new Error("Unable to fetch access token.");
        }
    }

    share(token, cookie, id) {
        delete headers.authority;
        delete headers.accept;
        delete headers["accept-language"];
        headers["accept-encoding"] = "gzip, deflate";
        headers["host"] = "graph.facebook.com";
        headers["cookie"] = cookie;

        let count = 0; // Số lần chia sẻ hiện tại
        const interval = setInterval(() => {
            if (count >= 60 || dailyBuffCounts[id] >= 100) { // Buff tối đa 60 lần/lần hoặc 100 lần/ngày
                clearInterval(interval);
                activeBuffs.delete(id); // Xóa ID khỏi danh sách đang buff
                console.log(`[ INFO ]: Finished buffing for ID ${id}.`.brightYellow);
                return;
            }

            axios({
                method: "POST",
                url: `https://graph.facebook.com/me/feed?link=https://m.facebook.com/${id}&published=0&access_token=${token}`,
                headers,
            })
                .then((res) => {
                    console.log("[ SUCCESS ]: ".brightWhite + `Shared post ID: ${res.data.id}`.brightGreen);
                    count++; // Tăng bộ đếm cho lần chạy này
                    dailyBuffCounts[id] = (dailyBuffCounts[id] || 0) + 1; // Tăng bộ đếm buff trong ngày
                })
                .catch((err) => {
                    console.log("[ ERROR ]:".brightWhite + ` Failed to share post for ID ${id}.`.brightRed, err.message);
                });
        }, 1000); // Gửi yêu cầu mỗi giây

        // Dừng buff sau 1 phút
        setTimeout(() => {
            clearInterval(interval);
            activeBuffs.delete(id); // Xóa ID khỏi danh sách đang buff
            console.log(`[ INFO ]: Buff stopped automatically for ID ${id}.`.brightYellow);
        }, 60000); // 1 phút
    }
}

const shareInstance = new Share();

// API endpoint
app.get("/api/share", async (req, res) => {
    try {
        const { id } = req.query; // Lấy `id` từ query string
        if (!id) {
            return res.status(400).json({ error: "Missing 'id' parameter in query." });
        }

        // Kiểm tra nếu ID đã được buff
        if (activeBuffs.has(id)) {
            return res.status(400).json({
                error: `ID ${id} is currently being buffed. Please wait until it completes.`,
            });
        }

        // Kiểm tra số lượng ID đang được buff (giới hạn 2 ID đồng thời)
        if (activeBuffs.size >= 2) {
            return res.status(429).json({
                error: "Too many concurrent buffs. Only 2 IDs can be buffed simultaneously.",
            });
        }

        // Kiểm tra giới hạn buff trong ngày
        if (dailyBuffCounts[id] && dailyBuffCounts[id] >= 100) {
            return res.status(429).json({
                error: `ID ${id} has reached the daily buff limit of 100.`,
            });
        }

        // Lấy token và bắt đầu buff
        const { accessToken, cookie } = await shareInstance.getToken();
        activeBuffs.set(id, true); // Thêm ID vào danh sách đang buff
        shareInstance.share(accessToken, cookie, id);
        res.status(200).json({ message: `Buff started successfully for ID ${id}.` });
    } catch (error) {
        console.error(`[ ERROR ]: ${error.message}`.brightRed);
        res.status(500).json({ error: "An error occurred while sharing." });
    }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
