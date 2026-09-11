const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3001;

// In-memory OTP storage
// Format: { 'email@example.com': { code: '123456', expiresAt: 1234567890 } }
const otpStore = {};

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

async function createTransporter() {
  try {
    const accessToken = await oAuth2Client.getAccessToken();
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.SENDER_EMAIL,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });
  } catch (error) {
    console.error("Error creating transporter:", error);
    throw error;
  }
}

app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 mins
  };

  try {
    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `"ConveyorGuard Security" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: 'Your ConveyorGuard Login Code',
      text: `Your 6-digit login code is: ${code}. It expires in 10 minutes.`,
      html: `<h3>Your Login Code</h3><p>Your 6-digit login code is: <strong>${code}</strong></p><p>It expires in 10 minutes.</p>`
    });
    console.log(`Sent OTP to ${email}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error("Failed to send email:", err);
    res.status(500).json({ error: 'Failed to send OTP email' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  const record = otpStore[email];
  if (!record) return res.status(400).json({ error: 'No OTP found or expired' });

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ error: 'OTP has expired' });
  }

  if (record.code === code) {
    delete otpStore[email];
    return res.json({ success: true });
  } else {
    return res.status(400).json({ error: 'Invalid OTP code' });
  }
});

app.post('/api/alerts/critical', async (req, res) => {
  const { email, defectDetails } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `"ConveyorGuard Alerts" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: '🚨 CRITICAL: Conveyor Anomaly Detected',
      text: `A critical anomaly was detected on the conveyor belt.\nDetails:\n${JSON.stringify(defectDetails, null, 2)}`,
      html: `<h3>🚨 Critical Conveyor Anomaly Detected</h3><p>Please inspect the system immediately.</p><pre>${JSON.stringify(defectDetails, null, 2)}</pre>`
    });
    console.log(`Sent critical alert to ${email}`);
    res.json({ success: true, message: 'Alert sent' });
  } catch (err) {
    console.error("Failed to send critical alert:", err);
    res.status(500).json({ error: 'Failed to send alert email' });
  }
});

app.listen(PORT, () => {
  console.log(`Node Mailer Service running on port ${PORT}`);
});
