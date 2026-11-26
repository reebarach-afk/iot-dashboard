require('dotenv').config();

const URL = 'http://localhost:5000/api/readings';

async function send() {
  const body = {
    device: 'esp32-01',
    temperature: +(24 + Math.random() * 10).toFixed(1),
    humidity: +(40 + Math.random() * 30).toFixed(1),
  };
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.DEVICE_API_KEY,
      },
      body: JSON.stringify(body),
    });
    console.log(res.status, body);
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

send();
setInterval(send, 5000);