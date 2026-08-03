# Eddu Quiz Audio Assets

These audio files are bundled locally so the live host/projection flow does not depend on network playback during a session.

## Current assets

| File | Use | Source |
| --- | --- | --- |
| `lobby-loop.mp3` | Looping lobby music while players join | Pixabay, "Upbeat Adventure Journey Loop 1" by Cyberwave-Orchestra |
| `question-loop.mp3` | Looping upbeat bed while a question is open before the final 5 seconds | Mixkit Stock Music, "Karma" by Michael Ramir C. |
| `game-start.mp3` | Start-game stinger | Mixkit, "Game magic hint" |
| `countdown-urgent.mp3` | Last-5-seconds countdown tension | Mixkit, "Simple countdown" |
| `time-up.mp3` | Time-up cue, non-bell/non-ring | Mixkit, "Melodic game over" |
| `award-third.mp3` | Final #3 reveal cue | Mixkit, "Revealing bonus notification" |
| `award-second.mp3` | Final #2 reveal cue | Mixkit, "Correct answer reward" |
| `award-champion.mp3` | Final champion cue | Mixkit, "End of show clapping crowd" |
| `workshop-loop.wav` | Legacy fallback loop from the earlier MVP | Local generated/bundled asset |

## Licensing notes

- Mixkit source page: https://mixkit.co/free-sound-effects/game-show/
- Mixkit stock music page: https://mixkit.co/free-stock-music/tag/game-show/
- Mixkit license: https://mixkit.co/license/
- Lobby track source: https://pixabay.com/music/adventure-upbeat-adventure-journey-loop-1-382201/
- Lobby track creator: Cyberwave-Orchestra
- Lobby track downloaded: 2026-08-03
- Lobby track duration: 7:16 (436.4 seconds)
- Lobby track license: https://pixabay.com/service/license-summary/
- The lobby track is marked `Content ID Registered` by Pixabay. Keep the source and license details above with the bundled file for future claim review.
- Audio analysis found no silent tail at `-45 dB` for 0.15 seconds. The player crossfades one second before the measured end and keeps a small decoder margin to avoid an MP3 boundary gap.
