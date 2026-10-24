import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import axios from "axios";

// Inisialisasi Firebase Admin menggunakan Environment Variables Vercel
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

export default async function handler(req, res) {
  try {
    // Panggilan API pencarian TikTok berdasarkan hashtag
    const options = {
      method: 'GET',
      url: 'https://tiktok-search-result.p.rapidapi.com/search/video',
      params: { query: '#gstr', count: '20' },
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

    // Simpan otomatis ke Firebase Realtime Database
    await db.ref('nmc_data/leaderboard/Sonofsukri').set(formattedData);

    return res.status(200).json({ success: true, message: "TikTok leaderboard synced successfully!" });
  } catch (error) {
    console.error("Sync error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
