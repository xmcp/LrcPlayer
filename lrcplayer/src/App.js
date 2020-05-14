import React, {useRef} from 'react';
import {LrcPlayer} from './LrcView';

import kiseki_mp3 from './assets/kiseki.mp3';
import kiseki_json from './assets/kiseki.json';

function App() {
    const ref=useRef(null);

    return (
        <div className="container">
            <h1>LrcPlayer by @xmcp</h1>
            <ul>
                <li>基于React</li>
                <li>
                    KTV歌词（可以
                    <a href="https://github.com/xmcp/qrcd" target="_blank" rel="noreferrer noopener">从QQ音乐的QRC格式转换</a>
                    ）
                </li>
                <li>同时显示原词、罗马音和翻译歌词</li>
                <li>
                    音量可视化（
                    <a href="https://stackoverflow.com/questions/13958158/why-arent-safari-or-firefox-able-to-process-audio-data-from-mediaelementsource?noredirect=1&lq=1" target="_blank" rel="noreferrer noopener">
                        不支持Safari
                    </a>
                    ）
                </li>
            </ul>
            <br />
            <p style={{textAlign: 'center'}}>Demo ↓</p>
            <LrcPlayer src={kiseki_mp3} lyrics={kiseki_json} ref={ref} />
            <p>
                Ref is forwarded to <code>&lt;audio></code> DOM element, so you can
            </p>
            <p>
                <button onClick={()=>ref.current.play()}>play()</button> ,&nbsp;
                <button onClick={()=>ref.current.pause()}>pause()</button> ,&nbsp;
                <button onClick={()=>{try{ref.current.volume=parseFloat(prompt('$0.volume='))}catch(_){}}}>volume=</button> , etc.
            </p>
        </div>
    );
}

export default App;
