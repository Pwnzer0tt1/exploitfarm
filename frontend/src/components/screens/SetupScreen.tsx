import { setSetup, statusQuery } from "@/utils/queries";
import { AttackMode, SetupStatus } from "@/utils/types";
import { Alert, Badge, Box, Button, Container, Divider, NumberInput, PasswordInput, Space, Switch, TextInput, Title } from "@mantine/core"
import { DateTimePicker } from '@mantine/dates';
import { useEffect, useMemo, useState } from "react";
import { useImmer } from "use-immer"
import { CancelActionButton, EditActionButton, EnableActionButton } from "@/components/elements/StatusIcon";
import { secondDurationToString } from "@/utils/time";
import { AttackModeControl } from "@/components/inputs/Controllers";
import { WelcomeTitle } from "@/components/elements/WelcomeTitle";
import { notifications, useNotifications } from "@mantine/notifications";
import { MdError } from "react-icons/md";
import { TeamEditModal } from "@/components/modals/TeamEditModal";
import { useGlobalStore } from "@/utils/stores";
import { TiWarning } from "react-icons/ti";
import { SubmitterModal } from "../modals/SubmitterModal";
import { FaInfoCircle } from "react-icons/fa";
import { AttackModeHelpModal } from "../modals/AttackModeHelpModal";
import { useDebouncedCallback } from '@mantine/hooks';

export type ConfigDict = {
    FLAG_REGEX?: string,
    START_TIME?: string|null,
    END_TIME?: string|null,
    TICK_DURATION?: number,
    ATTACK_MODE?:AttackMode,
    LOOP_ATTACK_DELAY?: number,
    ATTACK_TIME_TICK_DELAY?: number,
    FLAG_TIMEOUT?: number|null,
    FLAG_SUBMIT_LIMIT?: number|null,
    SUBMIT_DELAY?: number,
    SUBMITTER?: number|null,
    SUBMITTER_TIMEOUT?: number,
    AUTHENTICATION_REQUIRED?: boolean,
    PASSWORD_HASH?: string|null|boolean,
    SETUP_STATUS?: SetupStatus,
    [key: string]: any
}

export const SetupScreen = ({ editMode, onSubmit }:{ editMode?:boolean, onSubmit?:()=>void }) => {
    const setLoading = useGlobalStore((store) => store.setLoader)
    const [configInput, setConfigInput] = useImmer<ConfigDict>({})
    const [lastStatusFetched, setLastStatusFetched] = useImmer<ConfigDict>({})
    const [customPassword, setCustomPassword] = useState(true)
    const [passwordInputValue, setPasswordInputValue] = useState("")
    const [errorSetup, setErrorSetup] = useState<null|string>(null)
    const [disableInputs, setDisableInputs] = useState(false)
    const [openTeamModal, setOpenTeamModal] = useState(false)
    const [openSubmitterModal, setOpenSubmitterModal] = useState(false)
    const [infoAttackModeModal, setInfoAttackModeModal] = useState(false)
    const notificationsStore = useNotifications();

    const notificationExists = (id: string) => {
        return notificationsStore.notifications.find((n)=>n.id == id)??notificationsStore.queue.find((n)=>n.id == id) != null
    }

    const reset = (all: boolean = false) => {
        if (all){
            setCustomPassword(false)
            setErrorSetup(null)
            setOpenTeamModal(false)
        }
        setConfigInput({})
    }

    const status = statusQuery()
    useEffect(()=>{
        if (status.data?.config){
            setConfigInput(status.data.config as ConfigDict)
            if (status.data.config.PASSWORD_HASH !== null){
                setCustomPassword(false)
            }
        }
    }, [status.isLoading])
    const finalConfig = useMemo<ConfigDict>(()=>({ ...((status.data?.config??{}) as ConfigDict), ...configInput }), [configInput, status.isFetching])
    const deltaConfig = useMemo<ConfigDict>(()=>{
        if (status.isFetching) return {}
        if (lastStatusFetched !== status.data?.config ){
            if (notificationExists("setup-update")){
                notifications.update({
                    id: "setup-update",
                    title: "Setting auto-update is running",
                    message: "The setup has been saved on the server",
                    autoClose: 700
                })
            }
            setLastStatusFetched(status.data?.config as ConfigDict)
            reset()
            setDisableInputs(false)
            return {}
        }
        let res:any = {}
        Object.keys(finalConfig).forEach((key)=>{
            if (key == "SUBMITTER") return null
            if ((key == "AUTHENTICATION_REQUIRED" || key == "PASSWORD_HASH")){
                if (customPassword) return null

            }
            if (key == "PASSWORD_HASH"){
                if (finalConfig.PASSWORD_HASH == true && status.data?.config?.PASSWORD_HASH != null){
                    return null
                }
            }
            if (((status.data?.config??{}) as ConfigDict)[key] !== finalConfig[key]){
                res[key] = finalConfig[key]
            }
        })

        return res
    }, [finalConfig, status.isFetching, lastStatusFetched])

    const updateData = useDebouncedCallback(()=>{
        if (Object.keys(deltaConfig).length == 0 || editMode) return
        setDisableInputs(true)
        notifications.show({
            id: "setup-update",
            title: "Setting auto-update is running",
            message: "The setup has been saved on the server",
            color: "green",
            loading: true,
            autoClose: false
        })
        setLastStatusFetched((draft)=>{draft.PASSWORD_HASH = null})
        setSetup(deltaConfig).then(()=>{
            setErrorSetup(null)
            if (typeof finalConfig.PASSWORD_HASH == "string" ){
                setConfigInput((draft)=>{draft.PASSWORD_HASH = true})
            }
        }).catch((e)=>{
            setErrorSetup(e.message as string)
        })
    }, 2500)

    useEffect(updateData, [updateData, deltaConfig])

    return <Container>
        {editMode?null:<>
            <Space h="xl" />
            <WelcomeTitle
                title="Exploitfarm Setup"
                description={<>This is the setup page. You can configure exploitfarm here.<br />This configuration is dinamically updated also during the execution.</>}
            />
            <Space h="xl" hiddenFrom="md" />
        </>}
        <Title order={2}><u>General configs</u></Title>
        <Space h="md" />
        <TextInput
            label={<>Regex [FLAG_REGEX]</>}
            placeholder="[A]{100,}="
            value={finalConfig.FLAG_REGEX}
            onChange={(e)=>setConfigInput((draft)=>{draft.FLAG_REGEX = e.target?.value??""})}
            withAsterisk
            disabled={disableInputs}
        />
        <Space h="md" />
        <NumberInput
            label="Tick duration (in seconds) [TICK_DURATION]"
            placeholder="120"
            description={<>The tick interval is of <b><u>{secondDurationToString(finalConfig.TICK_DURATION??1)}</u></b></>}
            clampBehavior="strict"
            min={0}
            withAsterisk
            value={finalConfig.TICK_DURATION}
            onChange={(e)=>setConfigInput((draft)=>{draft.TICK_DURATION = parseInt(e.toString())})}
            disabled={disableInputs}
        />
        <Space h="md" />

        
        <Box
            onClick={()=>setInfoAttackModeModal(true)}
            className="transparency-on-hover"
            style={{cursor:"pointer", alignItems:"center", display:"flex", float:"left", paddingBottom: 7}}
        >
            <FaInfoCircle />
            <Space w="xs" />
            <small>Attack strategy [ATTACK_MODE] <span style={{ color: "red" }}>*</span></small>
        </Box>
        <Space h="xs" />
        
        <Box style={{ width:"100%", flexWrap: "wrap", display:"flex" }}>
            <Box>
                <AttackModeControl 
                    onChange={
                        (v:AttackMode)=>setConfigInput((draft)=>{draft.ATTACK_MODE = v})
                    }
                    value={finalConfig.ATTACK_MODE??"tick-delay"}
                />
            </Box>
            <Box hiddenFrom="md" style={{ flexBasis: "100%", height:40 }} />
            <Space visibleFrom="md" w="lg" />
            <Box style={{ marginTop: -30, display: "flex", width:"100%", flex:1 }}>
                {
                    finalConfig.ATTACK_MODE == "tick-delay"?<>
                        <NumberInput
                            label="Tick time (in seconds) [TICK_DURATION]"
                            description={<>The attack delay is of <b><u>{secondDurationToString(finalConfig.TICK_DURATION??1)}</u></b></>}
                            value={finalConfig.TICK_DURATION}
                            style={{ width: "100%" }}
                            readOnly
                            disabled
                            min={0}
                        />
                    </>:
                    finalConfig.ATTACK_MODE == "loop-delay"?<>
                        <NumberInput
                            label="Attack delay (in seconds) [LOOP_ATTACK_DELAY]"
                            placeholder="120"
                            description={<>The attack delay is of <b><u>{secondDurationToString(finalConfig.LOOP_ATTACK_DELAY??1)}</u></b></>}
                            clampBehavior="strict"
                            min={0}
                            value={finalConfig.LOOP_ATTACK_DELAY}
                            onChange={(e)=>setConfigInput((draft)=>{draft.LOOP_ATTACK_DELAY = parseInt(e.toString())})}
                            style={{ width: "100%" }}
                            disabled={disableInputs}
                        />
                    </>:
                    finalConfig.ATTACK_MODE == "wait-for-time-tick"?<>
                        <NumberInput
                            label="Start delay of the attack (in seconds) [ATTACK_TIME_TICK_DELAY]"
                            placeholder="120"
                            description={<>The attack will start at the start of the tick after <b><u>{secondDurationToString(finalConfig.ATTACK_TIME_TICK_DELAY??1)}</u></b></>}
                            clampBehavior="strict"
                            min={0}
                            value={finalConfig.ATTACK_TIME_TICK_DELAY}
                            onChange={(e)=>setConfigInput((draft)=>{draft.ATTACK_TIME_TICK_DELAY = parseInt(e.toString())})}
                            style={{ width: "100%" }}
                            disabled={disableInputs}
                        />
                    </>:null
                }
            </Box>
        </Box>
        <Space hiddenFrom="md" h="sm" />
        <Divider my="md" />
        <Title order={2}><u>Authentication</u></Title>
        <Space h="md" />
        {(editMode && !status.data?.config?.AUTHENTICATION_REQUIRED)?<>
            <Alert
                color="yellow"
                title="Warning"
                icon={<TiWarning />}
            >
                Enabling the authentication will trigger the stop of all the running exploits, you can run them again manually (the password will be required at that time)
            </Alert>
            <Space h="md" />
        </>:null}
        <Box className="center-flex" style={{ width: "100%" }}>
            <PasswordInput
                label="Password (len >= 8) [PASSWORD_HASH]"
                description="Password required to enter and use the platform"
                placeholder="*******"
                disabled={!finalConfig.AUTHENTICATION_REQUIRED || (!customPassword && status.data?.config?.PASSWORD_HASH !== null) || disableInputs}
                style={{ width: "100%", marginRight: 10, opacity: finalConfig.AUTHENTICATION_REQUIRED?1:0.5}}
                value={passwordInputValue}
                onChange={(e)=>setPasswordInputValue(e.target.value)}
            />
            {(status.data?.config?.PASSWORD_HASH == null && finalConfig.AUTHENTICATION_REQUIRED)?<>
                <Box>
                    
                </Box>
            </>:null}
            {(finalConfig.AUTHENTICATION_REQUIRED)?
                <>
                    {finalConfig.PASSWORD_HASH !== null?
                        (!customPassword? // Auth required, hash is set and no custom password required (action button to enable custom password)
                            <Box><EditActionButton
                                onClick={()=>{
                                    setCustomPassword(true)
                                    setConfigInput((draft)=>{draft.PASSWORD_HASH = ""})
                                }}
                                style={{ marginTop: 43 }}
                                disabled={!finalConfig.AUTHENTICATION_REQUIRED || disableInputs}
                            /></Box>: // Auth required, hash is set and custom password required (action button to disable custom password)
                        <> 
                            <Box><EnableActionButton
                                onClick={()=>{
                                    setConfigInput((draft)=>{draft.PASSWORD_HASH = passwordInputValue})
                                    setPasswordInputValue("")
                                    setCustomPassword(false)
                                }}
                                style={{ marginTop: 43 }}
                                disabled={passwordInputValue.length < 8 || disableInputs}
                            /></Box>
                            <Space w="xs" />
                            <Box><CancelActionButton
                                onClick={()=>{
                                    setCustomPassword(false)
                                    setPasswordInputValue("")
                                    if (!status.data?.config?.AUTHENTICATION_REQUIRED){
                                        setConfigInput((draft)=>{draft.AUTHENTICATION_REQUIRED = false})
                                    }
                                }}
                                style={{ marginTop: 43 }}
                                disabled={disableInputs}
                            /></Box>
                        </>): //Auth required, hash is not set (action button to enable password input confirmation)
                            <Box><EnableActionButton
                                onClick={()=>{
                                    setPasswordInputValue("")
                                    setConfigInput((draft)=>{draft.PASSWORD_HASH = passwordInputValue})
                                }}
                                style={{ marginTop: 43 }}
                                disabled={passwordInputValue.length < 8 || disableInputs}
                            /></Box>
                        }<Space w="md" /></>
            :null}
            
            <Switch
                checked={finalConfig.AUTHENTICATION_REQUIRED}
                onChange={() => setConfigInput((draft)=>{
                    if (finalConfig.AUTHENTICATION_REQUIRED){
                        draft.PASSWORD_HASH = null
                        draft.AUTHENTICATION_REQUIRED = false
                        setCustomPassword(false)
                    }else{
                        draft.PASSWORD_HASH = ""
                        draft.AUTHENTICATION_REQUIRED = true
                        setCustomPassword(true)
                    }
                })}
                color="teal"
                size="md"
                disabled={disableInputs}
                style={{ marginTop: 43 }}
            />
        </Box>
        <Divider my="md" />
        <Title order={2}><u>Submitter</u></Title>
        <Space h="md" />
        <NumberInput
            withAsterisk
            label="Sumbitter max timeout for execution (in seconds) [SUBMITTER_TIMEOUT]"
            description="Maximum time for the submitter to execute"
            placeholder="30"
            clampBehavior="strict"
            min={1}
            disabled={finalConfig.SUBMITTER_TIMEOUT === null || disableInputs}
            style={{ width: "100%", marginRight: 10, opacity: (finalConfig.SUBMITTER_TIMEOUT !== null)?1:0.5}}
            value={finalConfig.SUBMITTER_TIMEOUT??0}
            onChange={(e)=>setConfigInput((draft)=>{draft.SUBMITTER_TIMEOUT = parseInt(e.toString())})}
        />
        <Space h="md" />
        <Box className="center-flex" style={{ width: "100%" }}>
            <NumberInput
                label="Max flags per submit [FLAG_SUBMIT_LIMIT]"
                description="Maximum number of flag submittable per submit execution"
                placeholder="500"
                clampBehavior="strict"
                min={0}
                disabled={finalConfig.FLAG_SUBMIT_LIMIT === null || disableInputs}
                style={{ width: "100%", marginRight: 10, opacity: (finalConfig.FLAG_SUBMIT_LIMIT !== null)?1:0.5}}
                value={finalConfig.FLAG_SUBMIT_LIMIT??100}
                onChange={(e)=>setConfigInput((draft)=>{draft.FLAG_SUBMIT_LIMIT = parseInt(e.toString())})}
            />
            <Switch
                checked={finalConfig.FLAG_SUBMIT_LIMIT !== null}
                onChange={() => setConfigInput((draft)=>{draft.FLAG_SUBMIT_LIMIT = finalConfig.FLAG_SUBMIT_LIMIT !== null?null:500})}
                color="teal"
                size="md"
                style={{ marginTop: 43 }}
                disabled={disableInputs}
            />
        </Box>
        <Space h="md" />
        <NumberInput
            label="Submitter request delay [SUBMIT_DELAY]"
            description="Delay between each submitter request"
            placeholder="5"
            clampBehavior="strict"
            min={0}
            style={{ width: "100%" }}
            value={finalConfig.SUBMIT_DELAY??0}
            onChange={(e)=>setConfigInput((draft)=>{draft.SUBMIT_DELAY = parseInt(e.toString())})}
            disabled={disableInputs}
        />
        <Divider my="md" />
        <Title order={2}><u>Flag config</u></Title>
        <Space h="md" />
        <Box className="center-flex" style={{ width: "100%" }}>
            <NumberInput
                label="Flag timeout (in seconds) [FLAG_TIMEOUT]"
                description="Maximum time before the flag is marked as timeouted (at least 1 submission attempt will be tried in any case)"
                placeholder="100"
                clampBehavior="strict"
                min={0}
                disabled={finalConfig.FLAG_TIMEOUT === null || disableInputs}
                style={{ width: "100%", marginRight: 10, opacity: (finalConfig.FLAG_TIMEOUT !== null)?1:0.5}}
                value={finalConfig.FLAG_TIMEOUT??0}
                onChange={(e)=>setConfigInput((draft)=>{draft.FLAG_TIMEOUT = parseInt(e.toString())})}
            />
            <Switch
                checked={finalConfig.FLAG_TIMEOUT !== null}
                onChange={() => setConfigInput((draft)=>{draft.FLAG_TIMEOUT = finalConfig.FLAG_TIMEOUT !== null?null:60})}
                color="teal"
                size="md"
                style={{ marginTop: 43 }}
                disabled={disableInputs}
            />
        </Box>
        <Divider my="md" />
        <Title order={2}><u>Game time</u></Title>
        <Space h="md" />
        <Box className="center-flex" style={{ width: "100%" }}>
            <DateTimePicker
                withSeconds
                label="Start time [START_TIME]"
                value={finalConfig.START_TIME?new Date(finalConfig.START_TIME):null}
                placeholder="Starting time of the competition"
                description={<>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</>}
                onChange={(e)=>setConfigInput((draft)=>{draft.START_TIME = e?.toISOString()})}
                style={{ width: "100%", marginRight: 10}}
                disabled={disableInputs}
            />
            <CancelActionButton
                disabled={finalConfig.START_TIME === null || disableInputs}
                onClick={()=>{
                    setConfigInput((draft)=>{draft.START_TIME = null})
                }}
                style={{ marginTop: 43 }}
            />
        </Box>
        <Space h="md" />
        <Box className="center-flex" style={{ width: "100%" }}>
            <DateTimePicker
                withSeconds
                label="End time [END_TIME]"
                placeholder="Ending time of the competition"
                value={finalConfig.END_TIME?new Date(finalConfig.END_TIME):null}
                description={<>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</>}
                onChange={(e)=>setConfigInput((draft)=>{draft.END_TIME = e?.toISOString()})}
                style={{ width: "100%", marginRight: 10}}
                disabled={disableInputs}
            />
            <CancelActionButton
                disabled={finalConfig.END_TIME === null || disableInputs}
                onClick={()=>{
                    setConfigInput((draft)=>{draft.END_TIME = null})
                }}
                style={{ marginTop: 43 }}
            />
        </Box>
        <Divider my="md" />
        <Box className="center-flex" style={{justifyContent:"left"}}>
            <Box style={{ flexGrow:1 }} hiddenFrom="md" />
            <Badge
                size="lg"
                variant="gradient"
                gradient={{ from: 'red', to: 'grape', deg: 156 }}
                >
                <u>Submitter</u> {<>{status.data?.submitter?.name??"Not set!"}</>}
            </Badge>
            <Space w="md" />
            <Badge
                size="lg"
                variant="gradient"
                gradient={{ from: 'blue', to: 'teal', deg: 156 }}
                >
                <u>Teams</u> {<>{status.data?.teams?.length??0}</>}
            </Badge>
            <Box style={{ flexGrow:1 }} hiddenFrom="md" />
        </Box>
        <Space h="xl" />
        {errorSetup==null?null:<Alert
            variant="light"
            color="red"
            title="Error in the configuration"
            icon={<MdError />}
        >
            {errorSetup}
        </Alert>}
        <Space h="xl" />
        <Box className="center-flex" style={{ flexWrap: "wrap" }}>
            <Button
                color="red"
                size="md"
                onClick={()=>setOpenTeamModal(true)}
            >Teams 🚀</Button>
            <Space w="xl" />
            <Button
                color="lime"
                size="md"
                onClick={()=>setOpenSubmitterModal(true)}
            >
                Submitter 🚩
            </Button>
            <Box visibleFrom="md" style={{flexGrow: 1}} />
            <Box hiddenFrom="md" style={{ flexBasis: "100%", height:40 }} />
            <Button
                color="blue"
                size="lg"
                disabled={disableInputs}
                onClick={()=>{
                    setLoading(true)
                    setSetup({...deltaConfig, SETUP_STATUS: "running"} as ConfigDict).then(()=>{
                        setErrorSetup(null)
                        status.refetch()
                        notifications.show({
                            title: "Setup settings updated",
                            message: "The setup settings has been updated successfully!",
                            color: "green"
                        })
                        reset(true)
                        onSubmit?.()
                    }).catch((e)=>{
                        setErrorSetup(e.message as string)
                    }).finally(()=>{
                        setLoading(false)
                    })
                }}
            >
                {editMode?"Edit ⚙️":"Start Exploiting 👾 🚩"}
            </Button>
        </Box>
        <TeamEditModal close={()=>setOpenTeamModal(false)} opened={openTeamModal} />
        <SubmitterModal open={openSubmitterModal} onClose={()=>setOpenSubmitterModal(false)} />
        <AttackModeHelpModal onClose={()=>setInfoAttackModeModal(false)} open={infoAttackModeModal} />
        <Space h="xl" /> <Space h="xl" /> <Space h="xl" />
    </Container>
}
