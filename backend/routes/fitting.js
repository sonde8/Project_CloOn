const express = require('express');
const router = express.Router();
const axios = require("axios");  // HTTP 요청을 위한 axios 모듈 불러옴  // npm i axios 
const conn = require("../config/database");


router.post("/clothes", async (req, res) => {
    const userId = req.body.userId;
    const imagePath = req.body.imagePath;
    let clothesSizes = req.body.inputSizes;
    let clothesType = "";
    if (req.body.clothesType === "반팔") { clothesType = "t-shirt"; }
    else if (req.body.clothesType === "긴팔") { clothesType = "shirt"; }
    else if (req.body.clothesType === "긴바지") { clothesType = "pant"; }
    else { clothesType = "short-pant"; }

    try {
        const sql = `
            SELECT 
                gender, height, weight, arm_length, forearm_length, upper_length, thigh_length, leg_length,
                shoulder_width, waist_width, chest_width, hip_width, thigh_width,
                chest_circ, hip_circ, waist_circ
            FROM body_measurement
            WHERE user_id = ? AND image = ?
        `;

        // Promise 는 비동기 작업이 성공하거나 실패했을 때 그 결과를 반환하기 위해 사용
        let result = await new Promise((resolve, reject) => {  // 실행이 완료되면 resolve 를 반환, 실패하면 reject 를 반환
            conn.query(sql, [userId, imagePath], (err, rows) => {
                if (err) {
                    console.log("DB 에서 값 불러오기 실패 .. : ", err);
                    reject(err);  // 여기서 Promise 를 reject 하여 catch 블록으로 이동하게 만듬
                } else {
                    console.log("DB 에서 값 가져오기 성공 !");
                    resolve(rows[0]);  // rows[0] 값들을 resolve 를 이용해서 result 변수에 할당
                }
            });
        });

        // console.log("옷 타입 : ", clothesType);
        // console.log("사용자가 입력한 옷 사이즈 : ", clothesSizes);
        // console.log("DB 에서 가져온 사용자의 신체 측정 치수 값 : ", result);

        if (result) {
            // FastAPI 서버 URL 
            const url = "https://1fa0-114-110-128-38.ngrok-free.app";
            const response = await axios.post(`${url}/api/fitting`, { clothesType, clothesSizes, result }, {
                headers: { "Content-Type": "application/json" },
                maxBodyLength: Infinity  // Body 길이 무제한 설정 (대용량 데이터 전송을 위한 설정)
            });
            console.log("FastAPI 에서 가져온 결과 값들 : ", response.data);

            if (clothesType === "t-shirt" || clothesType === "shirt") {
                const sql = `INSERT INTO top_fitting (user_id, top_type, top_length, shoulder_width, chest_width, arm_length, fitting_img) VALUES (?, ?, ?, ? ,?, ?, ?)`;
                conn.query(sql, [userId, clothesType, clothesSizes.length, clothesSizes.shoulder, clothesSizes.chest, clothesSizes.sleeve, response.data.image_path], (err, rows) => {
                    if (err) {
                        console.log("DB 저장 실패 : ", err);
                        return res.status(500).json({ error: "Database error" });
                    } else {
                        console.log("DB 저장 성공 !!");
                        res.json({ success: true });   
                    }
                });
            } else {
                const sql = `INSERT INTO btm_fitting (user_id, btm_type, btm_length, waist_width, hip_width, thigh_width, fitting_img) VALUES (?, ?, ?, ? ,?, ?, ?)`;
                conn.query(sql, [userId, clothesType, clothesSizes.length, clothesSizes.waist, clothesSizes.hip, clothesSizes.thigh, response.data.image_path], (err, rows) => {
                    if (err) {
                        console.log("DB 저장 실패 : ", err);
                        return res.status(500).json({ error: "Database error" });
                    } else {
                        console.log("DB 저장 성공 !!");
                        res.json({ success: true });
                    }
                });
            }

        } else {
            res.status(404).send("해당 사용자의 측정 데이터가 없습니다.");
        }

    } catch (err) {
        console.error("데이터 가져오기 오류 : ", err);
        res.status(500).send("서버 오류 발생");
    }
});


router.get("/heatmap/:userId", async (req, res) => {
    const userId = req.params.userId;
    console.log("Received request for userId:", userId);

    try {
        const query = `
            SELECT fitting_img, fitting_date
            FROM (
                SELECT fitting_img, fitting_date
                FROM top_fitting
                WHERE user_id = ?
                UNION ALL
                SELECT fitting_img, fitting_date
                FROM btm_fitting
                WHERE user_id = ?
            ) combined
            ORDER BY fitting_date DESC
            LIMIT 1
        `;
        
        
        const [result] = await conn.promise().query(query, [userId, userId]);
        
        // CORS 헤더 추가
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        if (result.length > 0) {
            res.json({ 
                success: true, 
                imagePath: result[0].fitting_img,
                createdAt: result[0].fitting_date
            });
        } else {
            res.json({ 
                success: false, 
                message: "이미지를 찾을 수 없습니다." 
            });
        }
    } catch (error) {
        console.error("Database error:", error); // 상세 에러 로깅
        res.status(500).json({ 
            success: false, 
            message: "서버 에러가 발생했습니다.",
            error: error.message 
        });
    }
});



module.exports = router;