import { useEffect, useState } from "react";
import { flagsRequest, statusQuery } from "./queries";
import { AttackExecutionRestricted } from "./types";
import { useInterval } from "@mantine/hooks";

export function stringToHash(string:string) {

    let hash = 0;

    if (string.length == 0) return hash;

    for (let i = 0; i < string.length; i++) {
        let char = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return hash;
}

export const hashedColor = (string:string) => {
    return GRAPH_COLOR_PALETTE[Math.abs(stringToHash(string)) % GRAPH_COLOR_PALETTE.length]
}

export const GRAPH_COLOR_PALETTE = [
    "red", "pink", "grape", "violet", "indigo", "blue", "cyan", "teal", "green", "lime", "yellow", "orange"
]

export const useTimeOptions = (): [Date|null, number|null] => {
    const status = statusQuery()
    const [startTime, setStartTime] = useState<Date|null>(null)
    const tickTime = status.data?.config?.TICK_DURATION

    useEffect(() => {(async () => {
        if (status.data?.config?.START_TIME != null) setStartTime(new Date(status.data?.config?.START_TIME))
        else {
            const flags = await flagsRequest(1, 1, { reversed: true })
            if (flags.items.length > 0){
                const firstTime = flags.items[0].attack.start_time
                if (firstTime != null)
                    setStartTime(new Date(firstTime))
                else
                    setStartTime(null)
            }else{
                setStartTime(null)
            }
        }
    })()},[status.data?.config?.START_TIME])
    
    return (startTime && tickTime)?[startTime, tickTime]:[null, null]
}

export const useTickSelector = () => {
    const [startTime, tickTime] = useTimeOptions()
    return (startTime == null || tickTime == null)?null:
    (date: string|Date) => {
        if (typeof date === "string") date = new Date(date)
        return Math.floor((date.getTime()-startTime.getTime())/(tickTime*1000))+1
    }
}

export const useTickInfo = () => {
    const [startTime, tickTime] = useTimeOptions()
    return (startTime == null || tickTime == null)?null:
    (tick: number) => {
        return new Date(startTime.getTime() + (tick-1)*tickTime*1000)
    }
}

export const useGetTick = () => {
    const status = statusQuery()
    const start = status.data?.start_time?new Date(status.data.start_time).getTime():null
    const end = status.data?.config?.END_TIME?new Date(status.data.config.END_TIME).getTime():null
    const tick = status.data?.config?.TICK_DURATION??-1

    const nextTickTime = () => {
        if (start == null || tick==-1) return Infinity
        const now = new Date().getTime()
        if (now < start) return -1
        const tickCalc = ((now-start)/1000)%tick
        if (end && now > end) return -2
        return tick-tickCalc
    }

    const [fooState, setFooState] = useState(false)

    const timerScheduler = useInterval(() => {
        setFooState(!fooState)
    }, 1000)
    
    useEffect(() => {
        timerScheduler.start()
        return () => timerScheduler.stop()
    },[])

    const tickCalc = nextTickTime()
    return {
        isSuccess: status.isSuccess && tickCalc != Infinity,
        gameStarted: tickCalc != -1 && tickCalc != Infinity,
        gameEnded: tickCalc == -2,
        nextTickIn: tickCalc,
        start: start,
        end: end,
        tickDuration: tick,
    }
    
}



export const calcAttackDuration = ( attack: AttackExecutionRestricted) => {
    return (attack.start_time && attack.end_time)?(new Date(attack.end_time).getTime()-new Date(attack.start_time).getTime())/1000:null
}