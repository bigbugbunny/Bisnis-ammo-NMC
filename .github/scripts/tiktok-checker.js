const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function extractTikTokUsername(input) {
    if (!input) return '';
    let clean = String(input).trim();
    if (clean.includes('tiktok.com/')) {
        let parts = clean.split('tiktok.com/');
        let path = parts[1] || '';
        if (path.startsWith('@')) path = path.substring(1);
        return path.split('/')[0].split('?')[0];
    }
    if (clean.startsWith('@')) return clean.substring(1);
    return clean;
}

// Cek status live TikTok menggunakan URL lengkap /live dan analisis HTML halaman
async function checkTikTokLive(channelInput) {
    if (!channelInput) return false;
    
    let targetUrl = channelInput.trim();
    if (!targetUrl.includes('tiktok.com')) {
        let username = extractTikTokUsername(targetUrl);
        if (!username) return false;
        targetUrl = `https://www.tiktok.com/@${username}/live`;
    } else if (!targetUrl.endsWith('/live')) {
        targetUrl = targetUrl.endsWith('/') ? `${targetUrl}live` : `${targetUrl}/live`;
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        if (response.ok) {
            const htmlText = await response.text();
            // Deteksi status live aktif di dalam kode HTML profil/live TikTok
            if (htmlText.includes('"is-live":true') || htmlText.includes('room_id') || htmlText.includes('StreamPlayer')) {
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error(`Gagal cek link live ${targetUrl}:`, err.message);
        return false;
    }
}

async function run() {
    console.log("🔍 Memeriksa status live YouTube & TikTok otomatis...");
    
    const { data: streamers, error } = await supabase
        .from('streamers')
        .select('*');

    if (error || !streamers) {
        console.log("Tidak ada streamer atau terjadi error database.");
        return;
    }

    for (let s of streamers) {
        const oldVideoId = s.video_id || '';
        let isLive = false;
        let activeVideoId = '';
        const platform = s.platform ? s.platform.toLowerCase() : 'youtube';

        // 1. Pengecekan Platform TikTok
        if (platform === 'tiktok') {
            const isTikTokLive = await checkTikTokLive(s.channel_id);
            if (isTikTokLive) {
                isLive = true;
                activeVideoId = 'LIVE';
            }
        } 
        // 2. Pengecekan Platform YouTube
        else {
            if (s.channel_id && s.channel_id.startsWith('UC')) {
                try {
                    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${s.channel_id}&key=${YOUTUBE_API_KEY}`;
                    const chResponse = await fetch(channelUrl);
                    const chData = await chResponse.json();

                    if (chData.items && chData.items.length > 0) {
                        const uploadsPlaylistId = chData.items[0].contentDetails.relatedPlaylists.uploads;
                        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${YOUTUBE_API_KEY}`;
                        const plResponse = await fetch(playlistUrl);
                        const plData = await plResponse.json();

                        if (plData.items && plData.items.length > 0) {
                            const latestVideoId = plData.items[0].snippet.resourceId.videoId;
                            const videoDetailUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${latestVideoId}&key=${YOUTUBE_API_KEY}`;
                            const vResponse = await fetch(videoDetailUrl);
                            const vData = await vResponse.json();

                            if (vData.items && vData.items.length > 0) {
                                const videoInfo = vData.items[0];
                                if (videoInfo.snippet.liveBroadcastContent === 'live') {
                                    isLive = true;
                                    activeVideoId = latestVideoId;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error cek YouTube ${s.name}:`, e.message);
                }
            }
        }

        // Jika tidak live, kosongkan video_id secara otomatis
        if (!isLive) {
            activeVideoId = '';
        }

        // Update status ke Supabase
        if (oldVideoId !== activeVideoId) {
            await supabase
                .from('streamers')
                .update({ video_id: activeVideoId })
                .eq('id', s.id);
            console.log(`✨ ${s.name} status diperbarui: ${isLive ? 'LIVE 🟢' : 'OFF 🔴'}`);
        } else {
            console.log(`- ${s.name} tetap: ${isLive ? 'LIVE' : 'OFF'}`);
        }
    }
}

run();
