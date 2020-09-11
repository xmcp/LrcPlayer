import React, {useState, useEffect, useRef, useMemo} from 'react';
import PropTypes from 'prop-types';
import {SwitchTransition, CSSTransition} from 'react-transition-group';
import {PauseOutlined, PlayCircleOutlined} from '@ant-design/icons';

import './LrcView.css';

const CHUNK_OFFSET=250;
const LINE_OFFSET=350;

function useTrack(ds,t) { // return idx
    const [line,set_line]=useState(-1);

    useEffect(()=>{
        set_line(-1);
    },[ds]);

    useEffect(()=>{
        if(line>=0 && line<ds.length && ds[line][0]>t) // rewind
            set_line(-1);
        else if(line+1<ds.length && ds[line+1][0]<=t)
            set_line((l)=>{
                while(l+1<ds.length && ds[l+1][0]<=t)
                    l++;
                return l;
            });
    },[line,ds,t]);

    //console.log('!!!',line);
    
    return line;
}
useTrack.propTypes={
    ds: PropTypes.array.isRequired, // [time,_content]
    t: PropTypes.number.isRequired,
};

function LrcView(props) {
    const line_idx=useTrack(props.lyrics.time,props.t+LINE_OFFSET);
    const line=props.lyrics.lines[line_idx]||props.lyrics.default_line;

    const orig_idx=useTrack(line.orig,props.t+CHUNK_OFFSET);
    const roma_idx=useTrack(line.roma,props.t+CHUNK_OFFSET);

    const roma=line.roma[roma_idx] || [0, ''];
    const trans=(line.trans[0] || [0, ''])[1];

    return (
        <div>
            <SwitchTransition mode="out-in">
                <CSSTransition key={line_idx} classNames="lrc-anim" timeout={150}>
                    <div className="lrc-line-orig">
                        {line.orig.map((chunk, i) => {
                            let mode=(i===orig_idx ? 'prs' : i<orig_idx ? 'pst' : 'ftr');
                            if(mode==='prs') // add roma ruby
                                return (
                                    <span key={i} className={'lrc-chunk lrc-chunk-'+mode}>
                                            <ruby>
                                                <span className="lrc-ruby-base">{chunk[1]}</span>
                                                <rt>{roma[1].trim()}</rt>
                                            </ruby>
                                        </span>
                                );
                            else
                                return (
                                    <span key={i} className={'lrc-chunk lrc-chunk-'+mode}>{chunk[1]}</span>
                                );
                        })}
                    </div>
                </CSSTransition>
            </SwitchTransition>
            {props.translate_anim ?
                <SwitchTransition mode="out-in">
                    <CSSTransition key={line_idx} classNames="lrc-anim" timeout={150}>
                        <div className="lrc-line-trans">
                            {trans}
                        </div>
                    </CSSTransition>
                </SwitchTransition> :
                <div className="lrc-line-trans">
                    {trans}
                </div>
            }
        </div>
    )
}
LrcView.propTypes={
    lyrics: PropTypes.object.isRequired,
    t: PropTypes.number.isRequired,
};

function TimeStr(props) {
    return useMemo(()=>{
        function fix2(x) {
            return x<10 ? ('0'+x) : (''+x);
        }

        if(props.secs===null)
            return '??';
        let s=props.secs;
        let m=Math.floor(s/60);
        s%=60;
        let h=Math.floor(m/60);
        m%=60;

        if(h)
            return `${h}:${fix2(m)}:${fix2(s)}`;
        else
            return `${m}:${fix2(s)}`;
    },[props.secs]);
}
TimeStr.propTypes={
    secs: PropTypes.number,
};

function make_vol_effect(elem,vol) {
    if(!elem) return;
    const fgcolor='hsl(39,100%,75%)';
    const bgcolor='hsl(39,100%,83%)';
    const width_perc=(vol*100).toFixed(1);
    elem.style.background=`linear-gradient(to right, ${fgcolor}, ${fgcolor} ${width_perc}%, ${bgcolor} ${width_perc}%)`;
}

const VOL_AVG_DOWN=.85;
const VOL_AVG_UP=.65;
const VOL_BASE=.1;
const VOL_AMPLIFY=2;

function LrcPlayer_(props,fwd_ref) {
    const _audio_elem=useRef(null);
    const audio_ctx=useRef(null);
    const box_elem=useRef(null);
    const [t,set_t]=useState(0);
    const [playing,set_playing]=useState(false);
    const [cur_vol,set_cur_vol]=useState(50);

    const audio_elem=fwd_ref||_audio_elem;

    // initialize
    useEffect(()=>{
        let VOL_HANDLING=true;

        // handle time change
        function fn() {
            if(audio_elem.current) {
                set_t(Math.floor(audio_elem.current.currentTime*1000));

                if(!VOL_HANDLING) {
                    make_vol_effect(box_elem.current,audio_elem.current.paused ? 0 : 1);
                }
            }

            requestAnimationFrame(fn);
        }
        fn();

        // handle play state change
        if(audio_elem.current) {
            audio_elem.current.addEventListener('play',()=>set_playing(true));
            audio_elem.current.addEventListener('pause',()=>set_playing(false));
        }

        // handle volume
        make_vol_effect(box_elem.current,0);
        if(audio_elem.current) {
            function createAudioMeter(audioContext) {
                const processor = audioContext.createScriptProcessor(2048);
                processor.volume=0;
                processor.onaudioprocess = function(event) {
                    const buf = event.inputBuffer.getChannelData(0);
                    const bufLength = buf.length;
                    let sum = 0;
                    let x;

                    for (var i = 0; i < bufLength; i++) {
                        x = buf[i];
                        sum += x * x
                    }
                    let rms = Math.sqrt(sum / bufLength);

                    if(audio_elem.current.volume===0)
                        rms=0;
                    else
                        rms/=audio_elem.current.volume;

                    if(!audio_elem.current || audio_elem.current.paused)
                        rms=0;
                    else
                        rms=Math.min(1,VOL_BASE+rms*(1-VOL_BASE)*(props.visualize_vol_amplify||VOL_AMPLIFY));

                    //console.log(rms);

                    // smooth
                    if(rms>this.volume)
                        this.volume = rms*(1-VOL_AVG_UP) + this.volume * VOL_AVG_UP;
                    else
                        this.volume = rms*(1-VOL_AVG_DOWN) + this.volume * VOL_AVG_DOWN;

                    if(box_elem.current)
                        make_vol_effect(box_elem.current,this.volume);
                };

                return processor;
            }

            if(window.AudioContext) {
                let audioContext = new window.AudioContext();
                audio_ctx.current = audioContext;
                let mediaStreamSource=audioContext.createMediaElementSource(audio_elem.current);
                let meter=createAudioMeter(audioContext);
                mediaStreamSource.connect(audioContext.destination);
                mediaStreamSource.connect(meter);
                meter.connect(audioContext.destination);
                mediaStreamSource.connect(audioContext.destination);
            } else {
                // don't use webkitAudioContext here or it will break the sound on safari
                // https://stackoverflow.com/questions/13958158/why-arent-safari-or-firefox-able-to-process-audio-data-from-mediaelementsource?noredirect=1&lq=1
                // instead, simply disable vol handling
                VOL_HANDLING=false;
            }
        }

        return ()=>{
            cancelAnimationFrame(fn);
        };
    },[props.visualize_vol_amplify]);

    useEffect(()=>{
        if(audio_elem.current) {
            audio_elem.current.volume=cur_vol/100;
            //alert(audio_elem.current.volume);
        }
    },[audio_elem,cur_vol]);

    function toggle_pause() {
        if(audio_elem.current) {
            if(audio_elem.current.paused) { // -> play
                audio_elem.current.volume=cur_vol/100;
                audio_elem.current.play();

                // https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
                if(audio_ctx.current)
                    audio_ctx.current.resume();
            }
            else // -> pause
                audio_elem.current.pause();
        }
    }

    function adjust_vol_up() {
        if(cur_vol>=100) set_cur_vol(100);
        else if(cur_vol>=30) set_cur_vol(cur_vol+10);
        else set_cur_vol(cur_vol+5);
    }

    function adjust_vol_down() {
        if(cur_vol<=0) set_cur_vol(0);
        else if(cur_vol<=30) set_cur_vol(cur_vol-5);
        else set_cur_vol(cur_vol-10);
    }

    // https://stackoverflow.com/questions/14087355/feature-test-for-html5-audio-restrictions-in-ios
    let should_hide_vol_ctrl=/(iPad|iPhone|iPod);/.test(navigator.userAgent);

    return (
        <div className="lrc-player" ref={box_elem}>
            <audio src={props.src} ref={audio_elem} loop={true} />
            <div className="lrc-left-box">
                <div onClick={toggle_pause} className="lrc-play-btn">
                    {playing ? <PauseOutlined /> : <PlayCircleOutlined />}
                </div>
                <div className="lrc-time-box">
                    <TimeStr secs={Math.floor(t/1000)} />
                </div>
            </div>
            <div className="lrc-right-box" style={should_hide_vol_ctrl ? {visibility: 'hidden'} : {}}>
                <div className="lrc-vol-adjust lrc-vol-adjust-up" onClick={adjust_vol_up}>V+</div>
                <div className="lrc-vol-current">{cur_vol}</div>
                <div className="lrc-vol-adjust lrc-vol-adjust-down" onClick={adjust_vol_down}>V-</div>
            </div>
            <div className="lrc-main-box">
                <LrcView lyrics={props.lyrics} t={t} translate_anim={props.translate_anim||true} />
            </div>
        </div>
    );
}
export const LrcPlayer=React.forwardRef(LrcPlayer_);
LrcPlayer.displayName='LrcPlayer';
LrcPlayer.propTypes={
    src: PropTypes.string.isRequired,
    lyrics: PropTypes.object.isRequired,
    visualize_vol_amplify: PropTypes.number,
    translate_anim: PropTypes.bool,
};