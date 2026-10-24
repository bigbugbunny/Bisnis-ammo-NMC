import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import axios from "axios";

if (!getApps().length) {
  initializeApp({
    credential: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
    },
    databaseURL: "https://nmc-management-default-rtdb.firebaseio.com/"
  });
}

const db = getDatabase();

async function fetchAndSave(hashtag, categoryName) {
  try {
    const options = {
      method: 'GET',
      url: 'https://tiktok-search-result.p.rapidapi.com/search/video',
      params: { query: `#${hashtag}`, count: '20' },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'tiktok-search-result.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    const videos = response.data.videos || [];

    let formattedData = {};
    videos.forEach(video => {
      const videoId = video.video_id;
      const views = video.play_count || 0;
      formattedData[videoId] = {
        id: videoId,
        username: `@${video.author.unique_id}`,
        name: video.author.nickname,
        desc: video.title,
        upload: "Baru saja",
        views: views,
        viewsStr: views >= 1000000 ? (views / 1000000).toFixed(1) + 'M' : (views >= 1000 ? (views / 1000).toFixed(1) + 'K' : views),
        likes: video.digg_count || 0,
        link: `https://www.tiktok.com/@${video.author.unique_id}/video/${videoId}`
      };
    });

    await db.ref(`nmc_data/leaderboard/${categoryName}`).set(formattedData);
  } catch (err) {
    console.error(`Gagal sync hashtag #${hashtag}:`, err.message);
  }
}

export default async function handler(req, res) {
  try {
    // Sinkronisasi otomatis berdasarkan hashtag baru Anda
    await fetchAndSave('nmc', 'Sonofsukri');   // Tagar #nmc masuk ke tab Sonofsukri
    await fetchAndSave('mnc7g', 'GiString');    // Tagar #mnc7g masuk ke tab GiString
    await fetchAndSave('triad', 'TriadCommunity'); // Tagar #triad masuk ke kategori baru

    return res.status(200).json({ success: true, message: "Semua hashtag #nmc, #mnc7g, dan #triad berhasil disinkronkan!" });
  } catch (error) {
    console.error("Sync error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
