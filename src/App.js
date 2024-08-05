import React, {useEffect, useState} from 'react';
import get from 'just-safe-get';
import {styled} from 'baseui';

import {Scrubber} from "react-scrubber";
import 'react-scrubber/lib/scrubber.css';

const es = new EventSource("/sse");

const useAnimationFrame = callback => {
    // Use useRef for mutable variables that we want to persist
    // without triggering a re-render on their change
    const requestRef = React.useRef();
    const previousTimeRef = React.useRef();

    const animate = time => {
        if (previousTimeRef.current !== undefined) {
            const deltaTime = time - previousTimeRef.current;
            callback(deltaTime)
        }
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(animate);
    }

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    });
}

const PlayControls = styled('div', {
    marginLeft: '1em',
})

const AlbumInfoContainer = styled('div', {
    display: 'flex'
})

const SongMetadataContainer = styled('div', {
    marginLeft: '1em',
})

const TrackTime = styled('div', {
    marginTop: '0.5em',
    marginRight: 0,
    marginBottom: '0.5em',
    marginLeft: '0.5em',
})

const TrackProgress = styled('div', {
    marginTop: '0.5em',
    marginRight: 0,
    marginBottom: '0.5em',
    marginLeft: '0.5em',
    width: '8em',
})

const VolumeScrubberContainer = styled('div', {
    width: '8em',
})

function secondsToMMSS(seconds) {
    if (isNaN(seconds)) {
        return '--:--';
    }
    return new Date(seconds * 1000).toISOString().substr(14, 5)
}

function HEOS() {
    const [messages, setMessages] = useState([]);
    const [players, setPlayers] = useState({});
    const [activeKey, setActiveKey] = React.useState("0");

    useEffect(() => {
        es.onmessage = function (event) {
            setMessages([
                ...messages,
                event.data
            ])

            const data = JSON.parse(event.data);
            const commandGroup = get(data, 'heos.command.commandGroup')
            const command = get(data, 'heos.command.command')
            const updatedPlayers = {...players};

            if ("player" === commandGroup) {
                switch (command) {
                    case "get_players":
                        setPlayers(data.payload.reduce((playersObj, player) => {
                            playersObj[player.pid] = player;
                            return playersObj;
                        }, {}))

                        if (localStorage.getItem('activePlayerPid') !== null) {
                            setActiveKey(localStorage.getItem('activePlayerPid'))
                        } else {
                            setActiveKey(data.payload[0].pid);
                        }
                        break;

                    case "get_now_playing_media":
                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying = {
                            ...updatedPlayers[data.heos.message.parsed.pid].nowPlaying,
                            ...data.payload
                        };
                        setPlayers(updatedPlayers);
                        break;

                    case "get_play_state":
                        if (!updatedPlayers[data.heos.message.parsed.pid].nowPlaying) {
                            updatedPlayers[data.heos.message.parsed.pid].nowPlaying = {
                                pid: data.heos.message.parsed.pid
                            };
                        }
                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying.state = data.heos.message.parsed.state;
                        setPlayers(updatedPlayers);
                        break;

                    case "get_volume":
                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying.volume = data.heos.message.parsed.level;
                        setPlayers(updatedPlayers);
                        break;
                }
            } else if ("event" === commandGroup) {
                switch (command) {
                    case "player_now_playing_changed":
                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying = {
                            ...updatedPlayers[data.heos.message.parsed.pid].nowPlaying,
                            ...data.heos.message.parsed
                        };
                        setPlayers(updatedPlayers);
                        break;

                    case "player_now_playing_progress":
                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying = {
                            ...updatedPlayers[data.heos.message.parsed.pid].nowPlaying,
                            ...data.heos.message.parsed
                        };
                        setPlayers(updatedPlayers);
                        break;

                    case "player_state_changed":
                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying.state = data.heos.message.parsed.state;
                        setPlayers(updatedPlayers);
                        break;

                    case "player_volume_changed":
                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying.volume = data.heos.message.parsed.level;
                        setPlayers(updatedPlayers);
                        break;
                }
            }
        }
    });

    return (
        <table>
            {Object.values(players).map((player, idx) => {
                return (
                    <tr key={player.pid} title={player.name}>
                        <td>{player.name}</td>
                        <td>
                            <PlayerInfo player={player}/>
                        </td>
                        {0 === idx &&
                            <td rowSpan={Object.values(players).length}>
                                <PlayerAlbumInfo player={Object.values(players)[0]}/>
                            </td>
                        }
                    </tr>
                )
            })}
        </table>
    );
}

function SongMetadata({nowPlaying}) {
    return (
        <SongMetadataContainer>
            <strong>{nowPlaying.song}</strong><br/>
            {nowPlaying.artist} · {nowPlaying.album}
        </SongMetadataContainer>
    );
}

function nextTrack(pid) {
    fetch(`next?pid=${pid}`)
}

function previousTrack(pid) {
    fetch(`previous?pid=${pid}`)
}

function pauseTrack(pid) {
    fetch(`pause?pid=${pid}`)
}

function playTrack(pid) {
    fetch(`play?pid=${pid}`)
}

function setPlayerVolume(pid, level) {
    fetch(`set_volume?pid=${pid}&level=${level}`)
}

function Position({nowPlaying}) {
    const [playState, setPlayState] = React.useState()
    const [isScrubbing, setIsScrubbing] = React.useState(false)
    const [position, setPosition] = React.useState(null)
    const duration = nowPlaying.duration / 1000 || 0

    if (!isScrubbing) {
        if (position === null && nowPlaying.cur_pos !== 0) {
            setPosition(nowPlaying.cur_pos / 1000)
        }
        if (nowPlaying.cur_pos && Math.abs(nowPlaying.cur_pos / 1000 - position) > 10) {
            setPosition(nowPlaying.cur_pos / 1000)
        }
        if (nowPlaying.state && nowPlaying.state !== playState) {
            setPlayState(nowPlaying.state)
            setPosition(nowPlaying.cur_pos / 1000)
        }
    }

    useAnimationFrame(deltaTime => {
        // Pass on a function to the setter of the state
        // to make sure we always have the latest state
        if (!isScrubbing && playState !== "pause") {
            setPosition((prevPosition) => {
                if (!prevPosition) {
                    return null
                }
                const newTime = prevPosition + deltaTime / 1000
                return newTime
            })
        }
    }, [isScrubbing, playState])

    if (!nowPlaying.duration) {
        // return null;
    }

    function handleScrubStart(value) {
        setIsScrubbing(true)
    }

    function handleScrubChange(value) {
        setIsScrubbing(true)
        setPosition(value)
    }

    function handleScrubEnd(value) {
        setIsScrubbing(false)
    }

    return (
        <>
            <div style={{display: 'flex'}}>
                <PlayControls>
                    <a href="#" onClick={(evt) => {
                        evt.preventDefault();
                        previousTrack(nowPlaying.pid);
                    }}>⏮️️</a>
                    {playState === "play" && <a href="#" onClick={(evt) => {
                        evt.preventDefault();
                        pauseTrack(nowPlaying.pid);
                    }}>⏸</a>}
                    {(playState === "stop" || playState === "pause") && <a href="#" onClick={(evt) => {
                        evt.preventDefault();
                        playTrack(nowPlaying.pid);
                    }}>▶️️</a>}
                    <a href="#" onClick={(evt) => {
                        evt.preventDefault();
                        nextTrack(nowPlaying.pid);
                    }}>⏭️</a>

                </PlayControls>
                <TrackTime>{secondsToMMSS(position)} / {secondsToMMSS(duration)}</TrackTime>
                <TrackProgress>
                    <Scrubber
                        min={0}
                        max={duration}
                        value={position}
                        onScrubStart={handleScrubStart}
                        onScrubChange={handleScrubChange}
                        onScrubEnd={handleScrubEnd}
                    />
                </TrackProgress>
            </div>

        </>
    )
}

function PlayerAlbumInfo({player}) {
    if (!player || !player.nowPlaying) {
        return null;
    }

    return (
        <>
            <AlbumInfoContainer>
                <img width="200px" height="200px" alt={`${player.nowPlaying.artist} - ${player.nowPlaying.album}`}
                     src={player.nowPlaying.image_url}/>
                <div>
                    <SongMetadata nowPlaying={player.nowPlaying}/>
                    <Position nowPlaying={player.nowPlaying}/>
                </div>
            </AlbumInfoContainer>
        </>
    )
}

function PlayerInfo({player}) {
    const [isScrubbing, setIsScrubbing] = React.useState(false)
    const [volume, setVolume] = React.useState(undefined)

    if (!player.nowPlaying) {
        return null;
    }

    if (!isScrubbing && volume !== player.nowPlaying.volume) {
        setVolume(player.nowPlaying.volume);
    }

    function handleVolumeScrubStart(value) {
        setIsScrubbing(true)
    }

    function handleVolumeScrubChange(value) {
        setIsScrubbing(true)
        setVolume(value)
    }

    function handleVolumeScrubEnd(value) {
        setIsScrubbing(false)
        setPlayerVolume(player.pid, value);
        setVolume(value)
    }

    return (
        <>
            <VolumeScrubberContainer>
                <Scrubber
                    className="volume"
                    min={0}
                    max={100}
                    value={volume}
                    onScrubStart={handleVolumeScrubStart}
                    onScrubChange={handleVolumeScrubChange}
                    onScrubEnd={handleVolumeScrubEnd}
                />
            </VolumeScrubberContainer>
        </>
    )
}

function App() {
    return (
        <div className="App">
            <HEOS/>
        </div>
    );
}

export default App;
