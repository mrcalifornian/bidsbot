const fs = require("fs");
const axios = require("axios");
const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");

dotenv.config();
const token = process.env.TOKEN;
const link = process.env.LINK;
const channel = process.env.CHANNEL;
const admin = process.env.ADMIN;
const bot = new TelegramBot(token);

const DATA_FILE = "prevData.json";
let messageQueue = [];
let isProcessing = false;

const loadPrevData = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE));
    }
  } catch (error) {
    console.error("Error loading prevData:", error.message);
    notify(error.message);
  }
  return {};
};

const savePrevData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving prevData:", error.message);
    notify(error.message);
  }
};

const getData = async () => {
  try {
    let prevData = loadPrevData();
    const response = await axios.get(link);
    const data = response.data?.data?.data || [];

    if (!Array.isArray(data) || data.length === 0) {
      console.log("not array");
      return;
    }

    await Promise.all(
      data.map(async (load) => {
        const load_id = load.load_id;
        if (prevData[load_id]) return;

        prevData[load_id] = true;

        let message = `
*Load ID:* ${load_id}
*Total Distance:* ${load.total_distance} Miles

*Start:* ${load.load_start_date_str}
*End:*   ${load.load_end_date_str}\n`;

        load.stops.forEach((stop, index) => {
          message += `\n*Stop ${index + 1}:* ${stop.address}`;
        });

        messageQueue.push(message);
      })
    );

    savePrevData(prevData);
    processQueue();
  } catch (error) {
    console.error("Error fetching data:", error.message);
    notify(error.message);
  }
};

const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    try {
      await bot.sendMessage(channel, message, {
        parse_mode: "Markdown",
      });
      await new Promise((resolve) => setTimeout(resolve, 50)); // Rate limiting (≈28 msgs/sec)
    } catch (error) {
      console.error("Error sending message:", error.message);
      notify(error.message);
    }
  }

  isProcessing = false;
};

const notify = (message) => {
  bot.sendMessage(admin, message);
};

const start = () => {
  notify("Start");
  console.log("Start");
  getData();
  setInterval(getData, 1000 * 20);
};

start();

