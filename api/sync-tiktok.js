export default async function handler(req, res) {
    const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
    
    if (!APIFY_TOKEN) {
        return res.status(500).json({ success: false, error: "APIFY_API_TOKEN belum diset di Vercel." });
    }

    // Menggabungkan hashtag utama dalam satu kali pencarian agar cepat dan tidak timeout
    const searchQueries = ["#nmc", "#triad", "#nakama"]; 
    let totalSynced = 0;

    try {
        // Ambil data lama dari Firebase
        const fbRes = await fetch("https://nmc-management-default-rtdb.firebaseio.com/nmc_data/leaderboard.json");
        let existingData = await fbRes.json() || {};

        // Endpoint Apify TikTok Scraper dengan token yang aman
        const apifyUrl = `https://api.apify.com/v2/acts/clock~tiktok-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_API_TOKEN}`;
        
        const response = await fetch(apifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchQueries: searchQueries,
                resultsPerPage: 15
            })
        });

        if (response.ok) {
            const items = await response.json();
            
            if (Array.isArray(items)) {
                items.forEach(video => {
                    const videoId = video.id || video.videoId;
                    const views = video.playCount || video.stats?.playCount || 0;
                    const author = video.authorMeta || video.author || {};

                    if (videoId) {
                        existingData[videoId] = {
                            id: videoId,
                            username: `@${author.name || author.uniqueId || 'creator'}`,
                            name: author.nickName || author.nickname || 'Clipper',
                            desc: video.text || video.desc || '#nmc',
                            upload: "Baru saja",
                            views: views,
                            viewsStr: views >= 1000000 ? (views / 1000000).toFixed(1) + 'M' : (views >= 1000 ? (views / 1000).toFixed(1) + 'K' : views),
                            likes: video.diggCount || video.stats?.diggCount || 0,
                            link: video.webVideoUrl || `https://www.tiktok.com/@${author.name || 'user'}/video/${videoId}`
                        };
                        totalSynced++;
                    }
                });
            }
        }

        // Simpan hasil gabungan ke Firebase Realtime Database
        await fetch("https://nmc-management-default-rtdb.firebaseio.com/nmc_data/leaderboard.json", {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(existingData)
        });

        return res.status(200).json({ success: true, syncedCount: totalSynced });
    } catch (error) {
        console.error("Apify Sync Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
