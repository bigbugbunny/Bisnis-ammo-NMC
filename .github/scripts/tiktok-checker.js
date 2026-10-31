const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fungsi untuk mengekstrak username murni dari URL TikTok atau format @
function extractTikTokUsername(input) {
    if (!input) return '';
    let clean = String(input).trim();
    if (clean.includes('tiktok.com/@')) {
        let parts = clean.split('@')[1];
        return parts ? parts.split('/')[0].split('?')[0] : clean;
    }
    if (clean.startsWith('@')) {
        return clean.substring(1);
    }
    return clean;
}

// Fungsi mengirim Notifikasi ke Discord dengan tag @everyone
async function sendDiscordAlert(streamerName, platform, liveUrl) {
    if (!DISCORD_WEBHOOK_URL) return;

    const platformName = platform === 'tiktok' ? 'TikTok' : 'YouTube';
    const message = {
        content: `@everyone 🚨 **${streamerName}** sedang **LIVE** di **${platformName}**! 🎮🔥\nYuk langsung tonton dan ramaikan di Multiview Triad Community:\n🔗 ${liveUrl}`
    };

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
        console.log(`✅ Alert Discord terkirim untuk ${streamerName}`);
    } catch (err) {
        console.error("Gagal mengirim alert Discord:", err);
    }
}

// Cek Status Live TikTok
async function checkTikTokLive(channelInput) {
    const username = extractTikTokUsername(channelInput);
    if (!username) return false;

    try {
        const response = await fetch(`https://www.tiktok.com/@${username}/live`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await response.text();
        return html.includes('"is-live":true') || (html.includes('room_id') && !html.includes('This account is private'));
    } catch (err) {
        console.error(`Gagal cek @${username}:`, err.message);
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
        let isLive = false;
        let activeVideoId = '';
        const platform = s.platform ? s.platform.toLowerCase() : 'youtube';

        // 1. Pengecekan Platform TikTok
        if (platform === 'tiktok') {
            const username = extractTikTokUsername(s.channel_id);
            isLive = await checkTikTokLive(s.channel_id);
            activeVideoId = isLive ? 'LIVE' : '';
        } 
        // 2. Pengecekan Platform YouTube
        else {
            if (s.video_id && s.video_id.length > 5 && s.video_id.toUpperCase() !== 'LIVE') {
                isLive = true;
                activeVideoId = s.video_id;
            } else if (s.channel_id && s.channel_id.startsWith('UC')) {
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

        const wasLive = s.video_id === 'LIVE' || (s.video_id && s.video_id.length > 5);

        // Jika status berubah dari OFF menjadi LIVE, kirim alert Discord!
        if (isLive && !wasLive) {
            let liveUrl = platform === 'tiktok' 
                ? `https://www.tiktok.com/@${extractTikTokUsername(s.channel_id)}/live`
                : `https://www.youtube.com/watch?v=${activeVideoId}`;
            
            await sendDiscordAlert(s.name, platform, liveUrl);
        }

        // Update status ke Supabase jika ada perubahan
        if ((s.video_id === 'LIVE' || s.video_id?.length > 5) !== isLive || (platform === 'youtube' && s.video_id !== activeVideoId)) {
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
