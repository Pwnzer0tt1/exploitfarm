import { Box, Image, Space, Title } from "@mantine/core"
import { MotionStyle, cubicBezier, easeIn, motion, motionValue, useTime, useTransform } from "framer-motion"

import BombIcon from "@/svg/bomb.svg"
import FlagIcon from "@/svg/flag.svg"
import LaptopIcon from "@/svg/laptop.svg"
import ServerIcon from "@/svg/server.svg"
import ConnectedServerIcon from "@/svg/connected-server.svg"
import JoyStickIcon from "@/svg/joystick.svg"

export const WelcomeTitle = (
    { title, description, showAnimation }:
    { title?: string, description?: string, showAnimation?:boolean}) => {
    return <Box className="center-flex-col">
        <Box className="center-flex">
            <Title order={1} style={{
                textAlign: "center",
                zIndex:1
            }}>
                {title??"Welcome to ExploitFarm"}             
            </Title>
            <Image src="/logo.png" alt="ExploitFarm Logo" width={70} height={70} mih={70} miw={70} style={{marginLeft:5}}/> 
        </Box>
        <Space h="lg" />
        <Title order={3} style={{
            textAlign: "center",
            zIndex:1
        }}>
            {description??<>The attack manager and flag submitter by <a href="https://pwnzer0tt1.it" target="_blank">Pwnzer0tt1</a></>}
        </Title>
        <Box visibleFrom="sm">
            { (showAnimation??true)?<WelcomeAnimation />:null}
        </Box>
        <Space h="sm" />

    </Box>
}


export const WelcomeAnimation = () => {

    const time = useTime()
    const time_loop = motionValue(0)



    const tArr = (times: number[]): [number[], number] => {
        let accumulator = 0
        let time_result = times.map(t => {
            accumulator += t
            return accumulator
        })
        return [time_result, accumulator]
    }
    const animate_timing = cubicBezier(0.17, 0.67, 0.83, 0.67)
    const animate_linear = easeIn

    const [initial_icons_scale_time, end_initial_icons_scale_time] = tArr(
        [0, 200, 450]
    )

    const initial_icons: MotionStyle = {
        scale: useTransform(
            time_loop,
            initial_icons_scale_time,
            [0, 1.2, 1],
            { clamp: false, ease: animate_timing},
        ),
    }

    const init_middle_icons = end_initial_icons_scale_time+200
    const [middle_icons_scale_time, end_middle_icons_scale_time] = tArr(
        [init_middle_icons, 200, 300]
    )

    const middle_icons:MotionStyle = {
        opacity: useTransform(time_loop,[init_middle_icons],[1],
            { clamp: false, ease: animate_timing},
        ),
        scale: useTransform(
            time_loop,
            middle_icons_scale_time,
            [0, 1.2, 1],
            { clamp: false, ease: animate_timing},
        ),
    }
    const init_bomb_time = end_middle_icons_scale_time+600
    const [inital_bomb_scale_time, end_inital_bomb_scale_time] = tArr(
        [init_bomb_time, 200, 300]
    )
    const [bomb_rotate_time, end_bomb_rotate_time] = tArr(
        [init_bomb_time, 400, 400, 400]
    )
    const end_enter_time = Math.max(end_inital_bomb_scale_time, end_bomb_rotate_time)+800
    const [bomb_x_time, end_bomb_x_time] = tArr(
        [end_enter_time, 800]
    )
    const [final_bomb_scale_time, end_final_bomb_scale_time] = tArr(
        [end_bomb_x_time, 300, 400]
    )

    const bomb_animation: MotionStyle = {
        opacity: useTransform(time_loop,[1400],[1],
            { clamp: false, ease: animate_timing},
        ),
        scale: useTransform(
            time_loop,
            [...inital_bomb_scale_time, ...final_bomb_scale_time],
            [0, 1.2, 1, 1, 1.3, 0],
            { clamp: false, ease: animate_timing},
        ),
        rotate: useTransform(
            time_loop,
            bomb_rotate_time,
            [0, 30, -30, 0],
            { clamp: false, ease: animate_timing},
        ),
        x: useTransform(
            time_loop,
            bomb_x_time,
            [0, -100],
            { clamp: false, ease: animate_linear},
        ),
    }

    const init_flag_animation = end_final_bomb_scale_time+200
    const [inital_flag_scale_time, end_inital_flag_scale_time] = tArr(
        [init_flag_animation, 200, 300]
    )

    const delay_flag_remain = 300
    const [x_flag_time_laptop, end_x_flag_time_laptop] = tArr(
        [end_inital_flag_scale_time+100, 600]
    )
    const [x_flag_time_server, end_x_flag_time_server] = tArr(
        [end_x_flag_time_laptop+delay_flag_remain, 600]
    )
    const [x_flag_time_submit, end_x_flag_time_submit] = tArr(
        [end_x_flag_time_server+delay_flag_remain, 600]
    )
    const end_flag_move = end_x_flag_time_submit+delay_flag_remain
    
    const [final_scale_flag_time, end_final_scale_flag_time] = tArr(
        [end_flag_move, 200, 300]
    )

    const flag_animation: MotionStyle = {
        opacity: useTransform(time_loop,[0, init_flag_animation-1, init_flag_animation],[0, 0, 1],
            { clamp: false, ease: animate_timing},
        ),
        rotate: useTransform(
            time_loop,
            [
                end_x_flag_time_laptop,
                end_x_flag_time_laptop+(delay_flag_remain/3),
                end_x_flag_time_laptop+(delay_flag_remain/3)*2,
                end_x_flag_time_laptop+delay_flag_remain,
                end_x_flag_time_server,
                end_x_flag_time_server+(delay_flag_remain/3),
                end_x_flag_time_server+(delay_flag_remain/3)*2,
                end_x_flag_time_server+delay_flag_remain,
                end_x_flag_time_submit,
                end_x_flag_time_submit+(delay_flag_remain/3),
                end_x_flag_time_submit+(delay_flag_remain/3)*2,
                end_flag_move,
            ],
            [0, 30, -30, 0, 0, 30, -30, 0, 0, 30, -30, 0],
            { clamp: false, ease: animate_timing},
        ),
        scale: useTransform(
            time_loop,
            [
                ...inital_flag_scale_time,
                ...final_scale_flag_time,
            ],
            [0, 1.2, 1, 1, 1.2, 0],
            { clamp: false, ease: animate_timing},
        ),
        x: useTransform(
            time_loop,
            [
                ...x_flag_time_laptop,
                ...x_flag_time_server,
                ...x_flag_time_submit,
            ],
            [0, 130, 130, 265, 265, 420],
            { clamp: false, ease: animate_linear},
        ),
    }

    const init_plus_1_time = end_final_scale_flag_time+200

    const [initial_plus_1_time, end_initial_plus_1_time] = tArr(
        [init_plus_1_time, 200, 300]
    )

    const [up_plus_1_time, end_up_plus_1_time] = tArr(
        [init_plus_1_time, 200]
    )

    const final_init_plus_1_time = Math.max(end_initial_plus_1_time, end_up_plus_1_time)

    const [final_plus_1_time, end_final_plus_1_time] = tArr(
        [final_init_plus_1_time+1200, 200, 300]
    )

    const [fade_plus_1_time, end_fade_plus_1_time] = tArr(
        [final_init_plus_1_time, 400, 400, 400, 400]
    )

    const end_plus_1_time = Math.max(end_final_plus_1_time, end_fade_plus_1_time)

    const plus_1_animation: MotionStyle = {
        opacity: useTransform(
            time_loop,
            [
                0, init_plus_1_time-1, init_plus_1_time,
                ...fade_plus_1_time
            ],
            [0, 0, 1, 1, 0.4, 1, 0.4, 1],
            { clamp: false, ease: animate_timing},
        ),
        scale: useTransform(
            time_loop,
            [
                ...initial_plus_1_time,
                ...final_plus_1_time,
            ],
            [0, 1.2, 1, 1, 1.2, 0],
            { clamp: false, ease: animate_timing},
        ),
        y: useTransform(
            time_loop,
            up_plus_1_time,
            [0, -80],
            { clamp: false, ease: animate_timing },
        ),
    }

    const spaceBetween = 70
    const end_time_delay = 800

    time.on("change", (v) => {
        if (v > end_plus_1_time+end_time_delay)
            time_loop.set((v%(end_plus_1_time-init_bomb_time+end_time_delay))+init_bomb_time)
        else
            time_loop.set(v)
    })


    return <motion.div
        className="center-flex"
        style={{
            padding: 30,
            paddingTop:70,
            paddingBottom:70,
            position: "relative",
        }}
    >
        <motion.img src={ConnectedServerIcon} width={100} style={initial_icons} />
        <div style={{width: spaceBetween}} />
        <motion.img src={LaptopIcon} width={60} initial={{opacity:0}} style={middle_icons} />
        <div style={{width: spaceBetween}} />
        <motion.div style={middle_icons} initial={{opacity:0}}>
            <img src={ServerIcon} width={70} />
            <img src="/logo.png" width={60} style={{
                position: "absolute",
                display: "inline-block",
                left: 35,
                bottom: -15,
            }} />
        </motion.div>
        <div style={{width: spaceBetween}} />
        <motion.img src={JoyStickIcon} width={100} style={initial_icons} />
        <motion.img
            initial={{
                position: "absolute",
                opacity:0,
                left: 180,
            }}
            src={BombIcon}
            width={45}
            style={bomb_animation}
        />
        <motion.img
            initial={{
                position: "absolute",
                opacity:0,
                left: 80,
            }}
            src={FlagIcon}
            width={45}
            style={flag_animation}
        />
        <motion.h1 initial={{
            position: "absolute",
            opacity:1,
            left: 490,
            fontSize: 50,
            color: "#03C03C"
        }}
        style={{
            textShadow: "3px 3px 0px #000",
        ...plus_1_animation}}
        >+1</motion.h1>
    </motion.div>
}