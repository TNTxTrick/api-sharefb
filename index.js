const express = require("express");
const axios = require("axios");
require("colors");

const app = express();

app.get("/", (req, res) => {
    res.send("<h1>Facebook Share!</h1><p>tntxtrick</p>");
});

// Cookie trực tiếp trong code
const COOKIE = "sb=7W7-Zrs361QPN5PYjpTVzs48;datr=7W7-Zg2akABlM-ADlV1qDfZn;vpd=v1%3B736x393x2.75;ps_l=1;ps_n=1;locale=vi_VN;m_pixel_ratio=2.75;wd=393x736;c_user=61563608371247;fr=0dQMMga8bVF1zOqpV.AWU3gbR1YOb3qmVMBObNjvM2Wbs.Bm_m7t..AAA.0.0.Bnf7pI.AWWqumafFGA;xs=37%3AJylextEOpmr_Fw%3A2%3A1736424009%3A-1%3A11391;fbl_st=101525056%3BT%3A28940400;wl_cbv=v2%3Bclient_version%3A2710%3Btimestamp%3A1736424015;"; // Thay bằng cookie của bạn
 // Thay bằng cookie của bạn

const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
    'accept': '*/*',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
};

// Trạng thái xử lý cho từng ID
const processingIDs = new Set();

class Share {
    // Lấy access token từ Facebook
    async getToken() {
        try {
            headers["cookie"] = COOKIE;
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

    // Thực hiện buff chia sẻ
    async share(token, cookie, id) {
        if (processingIDs.has(id)) {
            console.log(`[ INFO ]: Buff for ID ${id} is already in progress.`.brightYellow);
            return;
        }

        // Đánh dấu ID đang được xử lý
        processingIDs.add(id);

        headers["cookie"] = cookie;
        headers["host"] = "graph.facebook.com";

        let count = 0; // Số lần chia sẻ hiện tại
        const interval = setInterval(() => {
            if (count >= 60) { // Giới hạn 60 lần chia sẻ mỗi phiên
                clearInterval(interval);
                processingIDs.delete(id); // Gỡ trạng thái sau khi hoàn tất
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
                    count++; // Tăng bộ đếm mỗi lần chia sẻ thành công
                })
                .catch((err) => {
                    console.log("[ ERROR ]:".brightWhite + ` Failed to share post for ID ${id}.`.brightRed, err.message);
                });
        }, 1000); // Gửi yêu cầu mỗi giây
    }
}

const shareInstance = new Share();

// API endpoint cho phép buff lại ngay sau khi hoàn tất
app.get("/api/share", async (req, res) => {
    try {
        const { id } = req.query; // Lấy `id` từ query string
        if (!id) {
            return res.status(400).json({ error: "Missing 'id' parameter in query." });
        }

        // Thực hiện buff
        const { accessToken, cookie } = await shareInstance.getToken();
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
