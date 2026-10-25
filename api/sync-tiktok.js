export default async function handler(req, res) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    
    if (!RAPIDAPI_KEY) {
        return res.status(500).json({ success: false, error: "RAPIDAPI_KEY belum dikonfigurasi di Vercel Environment Variables." });
    }

    const hashtags = ['nmc', 'nmc7g', 'triad', 'nakama', 'nffn'];
    // Host yang sesuai dengan endpoint TikTok Top Search di RapidAPI Anda
    const host = 'tiktok-top-search.p.rapidapi.com'; 
    let totalSynced = 0;

    try {
        const firebaseResponse = await fetch("https://nmc-management-default-rtdb.firebaseio.com/nmc_data/leaderboard.json");
        let existingData = await firebaseResponse.json() || {};

        for (const tag of hashtags) {
            // Menggunakan path endpoint v2/TikTok Top Search sesuai dokumentasi di dashboard Anda
            const url = `https://${host}/v2/TikTok%20Top%20Search%20(cursor%20paginated)_get?queries=%23${tag}&count=15`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': host
                }
            });

            if (response.ok) {
                const json = await response.json();
                
                // Menyesuaikan format respons JSON dari endpoint TikTok Top Search
                const items = json.data?.videos || json.videos || json.data || [];
                
                items.forEach(video => {
                    const videoId = video.video_id || video.id;
                    const views = video.play_count || video.stats?.playCount || 0;
                    
                    if (videoId) {
                        existingData[videoId] = {
                            id: videoId,
                            username: `@${video.author?.unique_id || video.author || 'creator'}`,
                            name: video.author?.nickname || 'Clipper',
                            desc: video.title || video.desc || `#${tag}`,
                            upload: "Baru saja",
                            views: views,
                            viewsStr: views >= 1000000 ? (views / 1000000).toFixed(1) + 'M' : (views >= 1000 ? (views / 1000).toFixed(1) + 'K' : views),
                            likes: video.digg_count || video.stats?.diggCount || 0,
                            link: `https://www.tiktok.com/@${video.author?.unique_id || 'user'}/video/${videoId}`
                        };
                        totalSynced++;
                    }
                });
            }
        }

        // Kirim dan simpan ke Firebase Realtime Database
        await fetch("https://nmc-management-default-rtdb.firebaseio.com/nmc_data/leaderboard.json", {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(existingData)
        });

        return res.status(200).json({ success: true, syncedCount: totalSynced });
    } catch (error) {
        console.error("Sync Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
