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
})

const PlayControl = styled('div', {
})

const SongMetadataContainer = styled('div', {
})

const AlbumInfoContainer = styled('div', {
    display: 'flex'
})

const TrackTime = styled('div', {
    marginTop: '0.5em',
    marginRight: 0,
    marginBottom: '0.5em',
})

const TrackProgress = styled('div', {
    marginTop: '0.5em',
    marginRight: 0,
    marginBottom: '0.5em',
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
                        if (!updatedPlayers[data.heos.message.parsed.pid]) return;

                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying = {
                            ...updatedPlayers[data.heos.message.parsed.pid].nowPlaying,
                            ...data.payload
                        };
                        setPlayers(updatedPlayers);
                        break;

                    case "get_play_state":
                        if (!updatedPlayers[data.heos.message.parsed.pid]) return;

                        if (!updatedPlayers[data.heos.message.parsed.pid].nowPlaying) {
                            updatedPlayers[data.heos.message.parsed.pid].nowPlaying = {
                                pid: data.heos.message.parsed.pid
                            };
                        }
                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying.state = data.heos.message.parsed.state;
                        setPlayers(updatedPlayers);
                        break;

                    case "get_volume":
                        if (!updatedPlayers[data.heos.message.parsed.pid]) return;

                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying.volume = data.heos.message.parsed.level;
                        setPlayers(updatedPlayers);
                        break;
                }
            } else if ("event" === commandGroup) {
                switch (command) {
                    case "player_now_playing_changed":
                        if (!updatedPlayers[data.heos.message.parsed.pid]) return;

                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying = {
                            ...updatedPlayers[data.heos.message.parsed.pid].nowPlaying,
                            ...data.heos.message.parsed
                        };
                        setPlayers(updatedPlayers);
                        break;

                    case "player_now_playing_progress":
                        if (!updatedPlayers[data.heos.message.parsed.pid]) return;

                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying = {
                            ...updatedPlayers[data.heos.message.parsed.pid].nowPlaying,
                            ...data.heos.message.parsed
                        };
                        setPlayers(updatedPlayers);
                        break;

                    case "player_state_changed":
                        if (!updatedPlayers[data.heos.message.parsed.pid]) return;

                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying.state = data.heos.message.parsed.state;
                        setPlayers(updatedPlayers);
                        break;

                    case "player_volume_changed":
                        if (!updatedPlayers[data.heos.message.parsed.pid]) return;

                        updatedPlayers[data.heos.message.parsed.pid].nowPlaying.volume = data.heos.message.parsed.level;
                        setPlayers(updatedPlayers);
                        break;
                }
            }
        }
    });

    return (
        <table>
            {Object.values(players).sort((p1, p2) => p1.name < p2.name ? -1 : 1).map((player, idx) => {
                return (
                    <tr key={player.pid} title={player.name}>
                        <td>{player.name}</td>
                        <td>
                            <PlayerVolume player={player}/>
                        </td>
                        {0 === idx && (
                            <td rowSpan={Object.values(players).length}>
                                <AlbumMetadata player={player}/>
                            </td>
                        )}
                        {0 === idx && (
                            <td rowSpan={Object.values(players).length}>
                                <SongMetadata player={player}/>
                                <PlayerPosition player={player}/>
                                <PlayerControls player={player}/>
                            </td>
                        )}
                    </tr>
                )
            })}
        </table>
    );
}
function AlbumMetadata({player}) {
    if (!player || !player.nowPlaying) {
        return null;
    }

    return (
        <>
            <AlbumInfoContainer>
                <img width="200px" height="200px" alt={`${player.nowPlaying.artist} - ${player.nowPlaying.album}`}
                     src={player.nowPlaying.image_url}/>
            </AlbumInfoContainer>
        </>
    )
}

function SongMetadata({player}) {
    if (!player || !player.nowPlaying) {
        return null;
    }

    return (
        <SongMetadataContainer>
            <strong>{player.nowPlaying.song}</strong><br/>
            {player.nowPlaying.artist} · {player.nowPlaying.album}
        </SongMetadataContainer>
    );
}

function PlayerButton({icon, clickFunc}) {
    return (
        <a href="#" onClick={(evt) => {
            evt.preventDefault();
            clickFunc();
        }}>{icon}</a>
    )
}

function PlayerControls({player}) {
    function nextTrack(pid) {
        fetch(`next?pid=${pid}`);
    }

    function previousTrack(pid) {
        fetch(`previous?pid=${pid}`);
    }

    function pauseTrack(pid) {
        fetch(`pause?pid=${pid}`);
    }

    function playTrack(pid) {
        fetch(`play?pid=${pid}`);
    }

    return (
        <>
            <div style={{display: 'flex'}}>
                <PlayerButton icon="⏮️️" clickFunc={() => {
                    previousTrack(player.pid);
                }}/>
                {player.nowPlaying && player.nowPlaying.state === "play"
                    && <PlayerButton icon="⏸️️️" clickFunc={() => {
                        pauseTrack(player.pid);
                    }}/>
                }
                {(player.nowPlaying && (player.nowPlaying.state === "stop" || player.nowPlaying.state === "pause"))
                    && <PlayerButton icon="▶️" clickFunc={() => {
                        playTrack(player.pid);
                    }}/>
                }
                <PlayerButton icon="⏭️" clickFunc={() => {
                        nextTrack(player.pid);
                }}/>
            </div>
        </>
    )
}

function PlayerPosition({player}) {
    const [playState, setPlayState] = React.useState();
    const [isScrubbing, setIsScrubbing] = React.useState(false);
    const [position, setPosition] = React.useState(null);
    var duration = 0;

    if (player && player.nowPlaying) {
        duration = player.nowPlaying.duration / 1000 || 0;

        if (!isScrubbing) {
            if (position === null && player.nowPlaying.cur_pos !== 0) {
                setPosition(player.nowPlaying.cur_pos / 1000);
            }
            if (player.nowPlaying.cur_pos && Math.abs(player.nowPlaying.cur_pos / 1000 - position) > 10) {
                setPosition(player.nowPlaying.cur_pos / 1000);
            }
            if (player.nowPlaying.state && player.nowPlaying.state !== playState) {
                setPlayState(player.nowPlaying.state);
                setPosition(player.nowPlaying.cur_pos / 1000);
            }
        }
    }

    useAnimationFrame(deltaTime => {
        // Pass on a function to the setter of the state
        // to make sure we always have the latest state
        if (!isScrubbing && playState !== "pause") {
            setPosition((prevPosition) => {
                if (!prevPosition) {
                    return null;
                }
                const newTime = prevPosition + deltaTime / 1000 ;

                return newTime;
            })
        }
    }, [isScrubbing, playState])

    function handleScrubStart(value) {
        setIsScrubbing(true)
    }

    function handleScrubChange(value) {
        setIsScrubbing(true);
        setPosition(value);
    }

    function handleScrubEnd(value) {
        setIsScrubbing(false);
    }

    return (
        <>
            <TrackProgress>
                <Scrubber
                    min={0}
                    max={duration}
                    value={position}
                    onScrubStart={handleScrubStart}
                    onScrubChange={handleScrubChange}
                    onScrubEnd={handleScrubEnd}
                />
                <TrackTime>{secondsToMMSS(position)} / {secondsToMMSS(duration)}</TrackTime>
            </TrackProgress>
        </>
    )
}

function PlayerVolume({player}) {
    const [isScrubbing, setIsScrubbing] = React.useState(false)
    const [volume, setVolume] = React.useState(undefined)

    if (!player.nowPlaying) {
        return null;
    }

    if (!isScrubbing && volume !== player.nowPlaying.volume) {
        setVolume(player.nowPlaying.volume);
    }

    function setPlayerVolume(pid, level) {
        fetch(`set_volume?pid=${pid}&level=${level}`)
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
                    min={0}
                    max={100}
                    value={volume}
                    markers={[50]}
                    onScrubStart={handleVolumeScrubStart}
                    onScrubChange={handleVolumeScrubChange}
                    onScrubEnd={handleVolumeScrubEnd}
                />
            </VolumeScrubberContainer>
            <span>{volume}</span>
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
