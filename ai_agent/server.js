const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 1. الدالة المساعدة للتواصل مع سيرفر بايثون
async function sendMessageToPython(userId, message) {
    try {
        const response = await axios.post('http://localhost:8000/api/chat', {
            user_id: userId,
            message: message
        });

        return response.data;
    } catch (error) {
        console.error("Error connecting to Python Agent:", error.message);
        throw new Error("Python Agent Service Unavailable");
    }
}

// 2. الـ Endpoint اللي هيستقبله من الـ Frontend
app.post('/api/user-message', async (req, res) => {
    const { userId, message } = req.body;

    if (!userId || !message) {
        return res.status(400).json({ error: "userId and message are required." });
    }

    try {
    
        const botResponse = await sendMessageToPython(userId, message);
        
  
        res.status(200).json({
            success: true,
            data: botResponse
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to communicate with AI Agent"
        });
    }
});

app.listen(3000, () => {
    console.log('Node.js server running on http://localhost:3000');
});