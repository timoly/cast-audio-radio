Cast Audio Radio

HLS radio stream support for Mopidy (https://www.mopidy.com).
This utility uses VLC for actual playback and stream http outputting.
It only provides support for starting and stopping VLC based on actual stream requests.
Similar functionality can be found in Livestreamer (http://docs.livestreamer.io/index.html)
but I had problems using it with some HLS streams with Mopidy and PulseAudio output.

Usage:
- Setup config.json with your radios.
- run cast-audio-radio in the same server as Mopidy, e.g. pm2 start index.js --name radio
- setup crontab to refresh Mopidy's internet radio playlist automatically, i.e.
  crontab -e and add line  */60 * * * * wget -O "/home/pi/.local/share/mopidy/m3u/[Radio Streams].m3u8" http://localhost:8082/playlist.m3u8


Prerequired:
- VLC
- NodeJS
