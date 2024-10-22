import { addSubmitter, checkSubmitterCode, deleteSubmitter, editSubmitter, setSetup, statusQuery, submittersQuery } from "@/utils/queries"
import { Alert, Box, Button, Divider, Group, Modal, NumberInput, Select, Space, Switch, Text, TextInput, Title } from "@mantine/core"
import { useEffect, useRef, useState } from "react"
import { useForm } from "@mantine/form";
import { FaInfoCircle } from "react-icons/fa";
import { SubmitterHelpModal } from "./SubmitterHelpModal";
import { CustomMonacoEditor } from "../elements/CustomMonacoEditor";
import { useDebouncedCallback } from "@mantine/hooks";
import { Dropzone } from '@mantine/dropzone';
import { KArgsTypeSelector } from "../inputs/KArgsInput";
import { KargsSubmitter } from "@/utils/types";
import { YesOrNoModal } from "./YesOrNoModal";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useGlobalStore } from "@/utils/stores";
import { DeleteButton } from "../inputs/Buttons";
import { TestSubmissionModal } from "./TestSubmissionModal";


const fromStringToValue = (label:string) => {
    if (label === "new") return -1
    return parseInt(label)
}

const fromNumberToString = (value:number) => {
    if (value === -1) return "new"
    return value.toString()
}

const guessType = (value:any) => {
    if (typeof value === "string") return "str"
    if (typeof value === "number") return "float"
    if (typeof value === "boolean") return "bool"
    return "str" //Default to string
}

const defaultTypeValue = (type:KargsSubmitter) => {
    if (type === "str") return ""
    if (type === "int" || type === "float") return 0
    if (type === "bool") return false
    return ""
}

const setDefaultSubmitter = (id:number) => {
    return setSetup({ SUBMITTER: id }).then((res) => {
        notifications.show({
            title: "Default submitter set!",
            message: res.message??"Default submitter has been set successfully!",
            color: "green",
        })
    }).catch((err) => {
        notifications.show({
            title: "Error during setting default submitter!",
            message: err.message??"Unknown error",
            color: "red",
        })
    })
}

export const SubmitterModal = ({ open, onClose }:{ open:boolean, onClose:()=>void}) => {
    const status = statusQuery()
    const submitters = submittersQuery()
    
    const [codeErrorDetails, setCodeErrorDetails] = useState({
        status: "loading",
        message: "Code check is loading..."
    })

    const dropZoneRef = useRef<() => void>(null);
    const [infoModal, setInfoModal] = useState(false)
    const [lastKArgsDetails, setLastKArgsDetails] = useState<{ [k:string]: {value:any, type:KargsSubmitter}}>({})
    const [selectedOption, setSelectedOption] = useState<number>(-1)
    const [resetAlert, setResetAlert] = useState(false)
    const [resetAlertAction, setResetAlertAction] = useState<() => void>(()=>{})
    const [setAsDefaultSubmitter, setSetAsDefaultSubmitter] = useState(false)
    const [deleteSubmitterConfirm, setDeleteSubmitterConfirm] = useState(false)
    const queryClient = useQueryClient()
    const { setLoader } = useGlobalStore()
    const [resetOnRefetch, setResetOnRefetch] = useState<number>(0)
    const [showKArgs, setShowKArgs] = useState(true)
    const [submissionToTest, setSubmissionToTest] = useState<number|undefined>()

    const workingSubmitterChoosen = status.data?.submitter
    const isDefaultSubmitter = workingSubmitterChoosen?.id === selectedOption
    const fetchedSubmitters = submitters.data?.map(submitter => ({ value: submitter.id.toString(), label: `${submitter.name}${(submitter.id == workingSubmitterChoosen?.id)?" - SELECTED 🔥":""}` }))??[] 
    const selectedSubmitter = submitters.data?.find(submitter => submitter.id === selectedOption)
    const thereWhereSubmitters = submitters.data?.length??1 > 0

    const selectOptions = [
        ...fetchedSubmitters,
        { value: "new", label: "ADD A NEW SUBMITTER ⚙️" }
    ]
    
    const form = useForm({
        initialValues: {
            code: "",
            name: "",
            kargs: {} as { [k:string]: any }
        },
        validate: {
            code: (value) => {
                if (value.trim() === "") return "Code is required."
                if (codeErrorDetails.status != "ok") return codeErrorDetails.message??"There was an unknown error."
                return null
            },
            name: (value) => value.trim() === "" ? "Name is required." : null,
            kargs: (values) => {
                return Object.keys(values).map((karg) => {
                    if (lastKArgsDetails[karg] == null) return
                    const type = lastKArgsDetails[karg].type
                    if (values[karg] == null) return
                    if (type === "str" && typeof values[karg] !== "string"){
                        return "The value must be a string."
                    }
                    if ((type === "int" || type === "float") && typeof values[karg] !== "number"){
                        return "The value must be a number."
                    }
                    if (type === "bool" && typeof values[karg] !== "boolean"){
                        return "The value must be a boolean."
                    }
                    return null
                }).filter((v) => v != null)[0]
            }
        },
    })



    const formReset = () => {
        form.reset()
        setSetAsDefaultSubmitter(false)
    }
    const formChanged = form.isDirty() || setAsDefaultSubmitter

    const checkCodeNoDebounced = () => {
        checkSubmitterCode(form.values.code).then((res) => {
            setCodeErrorDetails({
                status: res.status??"error",
                message: res.message??"There was an unknown error."
            })
            if (res.status === "ok"){
                setLastKArgsDetails(res.response??{})
                setShowKArgs(true)
            }else{
                setShowKArgs(false)
            }
        }).catch((err) => {
            setShowKArgs(false)
            setCodeErrorDetails({
                status: err.status??"error",
                message: err.message??"There was an unknown error."
            })
        })
    }

    const checkCode = useDebouncedCallback(() => {
        if (codeErrorDetails.status === "loading"){
            checkCodeNoDebounced()
        }
      }, 800);

    useEffect(() => {
        Object.keys(form.values.kargs).forEach((karg) => {
            if (lastKArgsDetails[karg] == null) return
            const type = lastKArgsDetails[karg].type
            if (
                type === "str" && typeof form.values.kargs[karg] !== "string" ||
                type === "int" && typeof form.values.kargs[karg] !== "number" ||
                type === "float" && typeof form.values.kargs[karg] !== "number" ||
                type === "bool" && typeof form.values.kargs[karg] !== "boolean"
            ){
                form.setFieldValue("kargs", { ...form.values.kargs, [karg]: defaultTypeValue(type) } )
            }
        })
    }, [form.values, lastKArgsDetails])

    useEffect(()=>{
        if (codeErrorDetails.status !== "ok"){
            setShowKArgs(false)
        }
        setCodeErrorDetails({
            status: "loading",
            message: "Requesting code checking..."
        })
        checkCode()
    }, [form.values.code])

    useEffect(() => {
        if (open && submitters.isSuccess && status.isSuccess){
            if (workingSubmitterChoosen){
                setSelectedOption(workingSubmitterChoosen.id)
            } else {
                setSelectedOption(fromStringToValue(selectOptions[0].value))
            }
        }
    }, [open, submitters.isLoading, status.isLoading])

    const updateInitialValues = () => {
        if (selectedOption === -1){
            form.setInitialValues({
                code: "",
                name: "",
                kargs: {}
            })
        } else if (submitters.isSuccess && selectedSubmitter != null){
            let kargs = {} as any
            Object.entries((selectedSubmitter.kargs)??{}).forEach((a) => {
                kargs[a[0]] = (selectedSubmitter.kargs??{})[a[0]]?.value??a[1].value
            })
            form.setInitialValues({
                code: selectedSubmitter.code,
                name: selectedSubmitter.name,
                kargs: kargs
            })   
        }
    }

    useEffect(()=>{
        if (!submitters.isRefetching){
            updateInitialValues()
            if(resetOnRefetch > 0){
                checkCode()
                formReset()
                setResetOnRefetch(0)
            }
        }
    }, [submitters.isRefetching, resetOnRefetch]) // reset initial values if updated

    useEffect(() => {
        if (open && submitters.isSuccess){
            queryClient.refetchQueries({ queryKey: ["submitters"] })
            setResetOnRefetch(resetOnRefetch+1) 
        }
    }, [selectedOption, open, submitters.isSuccess])

    return <Modal opened={open} onClose={()=>{
        if (
            submissionToTest != null||
            deleteSubmitterConfirm ||
            resetAlert || infoModal
        ) return
        if (formChanged){
            setResetAlert(true)
            setResetAlertAction(()=>onClose)
        } else {
            onClose()
        }
    }} title="Submitter Managment ⚙️" size="xl" centered fullScreen>
        <Select
            label="Select the submitter to work on"
            data={selectOptions}
            value={fromNumberToString(selectedOption)}
            onChange={(value) =>{
                if (formChanged){
                    setResetAlert(true)
                    setResetAlertAction(()=>()=>value && setSelectedOption(fromStringToValue(value)))
                }else{
                    value && setSelectedOption(fromStringToValue(value))
                }
                
            }}
        />
        <Space h="md" /><Divider /><Space h="md" />
        <Box display="flex" style={{alignItems:"center", width:"100%", flexDirection:"column"}}>
            <TextInput
                label="Name"
                placeholder="Submitter name"
                required
                withAsterisk
                style={{width:"100%"}}
                {...form.getInputProps("name")}
            />
            <Space h="md" />
            <Box className={"center-flex"}>
                <Text size="sm">{!thereWhereSubmitters?"This is the first submitter and must be set to the default":isDefaultSubmitter?"This is the actual working submitter! (set another to disable)":"Use this submitter"}</Text>
                <Space w="sm" />
                <Switch
                    checked={isDefaultSubmitter || setAsDefaultSubmitter || !thereWhereSubmitters}
                    color={(isDefaultSubmitter || !thereWhereSubmitters)?"lime":"blue"}
                    onChange={(value) => setSetAsDefaultSubmitter(value.target.checked)}
                /> 
            </Box>
        </Box>
        <Space h="md" />
        <Dropzone
            openRef={dropZoneRef}
            onDrop={(data) => data[0].text().then((newCode) => {
                const file = data[0]
                const nameChanged = form.isDirty("name")
                const refactoredName = file.name.replace("-", " ").replace(".py", "").replace(".PY", "").replace("_", " ")
                form.setFieldValue("code", newCode)
                if(!nameChanged) form.setFieldValue("name", refactoredName)
            })}
            activateOnClick={false}
            accept={{
                'text/x-python': ['.py'],
            }}
            multiple={false}
            maxFiles={1}
            maxSize={1024*512}
            dragEventsBubbling
            enablePointerEvents
            style={{paddingLeft:"5vw", paddingRight:"5vw"}}
        >
            <Box
                onClick={()=>setInfoModal(true)}
                className="transparency-on-hover"
                style={{cursor:"pointer", alignItems:"center", display:"flex", float:"left"}}
            >
                <FaInfoCircle />
                <Space w="xs" />
                Submitter python code help guide
            </Box>
            <Space h="sm" />
            <Text size="xs" style={{float:"right", paddingBottom:"6px"}}>Drop here a python file to edit and use it</Text>
            <CustomMonacoEditor {...form.getInputProps("code")} />
            <Box mt="md" display="flex" style={{alignItems:"center"}} >
                <Alert
                    color={codeErrorDetails.status != "ok"?(codeErrorDetails.status === "loading"?"grey":"red"):"green"}
                    title={codeErrorDetails.message}
                    style={{width:"100%"}}
                />
                <Space w="md" />
                <Box>
                    <Button onClick={() => dropZoneRef.current?.()} style={{minWidth:"90px"}} color="pink">
                        Load code
                    </Button>
                    <Space h="xs" />
                    <Text size="xs" style={{whiteSpace:"nowrap"}}>Max size: 512KB</Text>
                </Box>
            </Box>
        </Dropzone>
        <Space h="lg" />
        <Title order={3}>Additional Arguments</Title>
        
        {/* form.isValid("kargs")?null:<><Space h="md" /><Alert color="red" title="There are errors in the additional arguments" /></> */}
        {/* Auto correction of the type values if done by a React Effect, during fixing of the value error is flichering, so it was removed */}

        {
            Object.keys(showKArgs?lastKArgsDetails:{}).map((karg) => {
                const { value, type } = lastKArgsDetails[karg]

                const effectiveType = (type === "any"?guessType(form.values.kargs[karg]??value):type) as KargsSubmitter

                return <Box key={karg}>
                    <Space h="lg" />
                    <Text>{karg}:</Text>
                    <Space h="xs" />
                    <Box className="center-flex">
                        <KArgsTypeSelector
                            value={effectiveType}
                            onChange={type !== "any"?undefined:(newType) => {
                                form.setFieldValue("kargs", { ...form.values.kargs, [karg]: defaultTypeValue(newType??"str") })
                            }}
                        />
                        <Space w="md" />
                        {
                            effectiveType === "str"   ? <TextInput
                                value={form.values.kargs[karg]??value??""}
                                onChange={(e) => form.setFieldValue("kargs", { ...form.values.kargs, [karg]: e.currentTarget.value })}
                                style={{width:"100%"}}
                            /> :
                            effectiveType === "int"   ? <NumberInput
                                value={parseInt(form.values.kargs[karg]??value??0)}
                                onChange={(e) => form.setFieldValue("kargs", { ...form.values.kargs, [karg]: parseInt(e.toString()) })}
                                allowDecimal={false}
                                style={{width:"100%"}}
                            /> :
                            effectiveType === "float" ? <NumberInput
                                value={parseFloat(form.values.kargs[karg]??value??0)}
                                onChange={(e) => form.setFieldValue("kargs", { ...form.values.kargs, [karg]: parseFloat(e.toString()) })}
                                style={{width:"100%"}}
                            /> :
                            effectiveType === "bool"  ? <Select
                                data={[{value:"true", label:"True"}, {value:"false", label:"False"}]}
                                value={((form.values.kargs[karg]??value??false)?"true":"false")}
                                onChange={(value) => form.setFieldValue("kargs", { ...form.values.kargs, [karg]: value=="true" })}
                                style={{width:"100%"}}
                            /> : null


                        }
                    </Box>
                </Box>
            })

        }
        {Object.keys(lastKArgsDetails).length === 0 && <Text className="center-flex" style={{width:"100%"}}>No additional arguments found</Text>}
        {(Object.keys(lastKArgsDetails).length > 0 && !showKArgs )&& <Text className="center-flex" style={{width:"100%"}}>Additional arguments can be evalueted only if the code above is correct</Text>}
        <Space h="xl" />
        <Group mt="xl" justify="flex-end">
            <DeleteButton
                onClick={() => setDeleteSubmitterConfirm(true)}
                disabled={isDefaultSubmitter || selectedOption === -1}
            />
            <Button onClick={formReset} color="gray" disabled={!formChanged}>Reset</Button>
            <Button onClick={() => {
                if (formChanged){
                    notifications.show({
                        title: "You can't test an uncompleted submitter",
                        message: "Please complete all the edits and save the submitter before testing it",
                        color: "yellow"
                    })
                }else{
                    setSubmissionToTest(selectedOption)
                }
            }} color={!formChanged?"green":"grey"} disabled={!form.isValid()}>Try the submitter</Button>
            <Button
                color="blue"
                disabled={(!form.isValid() || !formChanged)}
                onClick={() => {
                    setLoader(true)
                    if (!form.isDirty() && setAsDefaultSubmitter){
                        //only requiring to change the default submitter
                        setDefaultSubmitter(selectedOption).then(() => {
                            queryClient.resetQueries({ queryKey: ["status"] })
                        })
                    }else if (selectedOption != -1){
                        let kargs = {} as any
                        Object.entries(form.values.kargs).forEach((a) => {
                            if (lastKArgsDetails[a[0]] == null) return
                            kargs[a[0]] = a[1]
                        })
                        form.values.kargs = kargs
                        editSubmitter(selectedOption, form.values).then((res) => {
                            notifications.show({
                                title: "Submitter edited!",
                                message: res.message??"Submitter has been edited successfully!",
                                color: "green",
                            })
                            queryClient.resetQueries({ queryKey: ["submitters"] })
                            setResetOnRefetch(resetOnRefetch+1)
                            if (setAsDefaultSubmitter){
                                setDefaultSubmitter(selectedOption).then(() => {
                                    queryClient.resetQueries({ queryKey: ["status"] })
                                })
                            }
                        }).catch((err) => {
                            notifications.show({
                                title: "Error during editing!",
                                message: err.message??"Unknown error",
                                color: "red",
                            })
                        }).finally(() => {
                            setLoader(false)
                        })
                    }else{
                        
                        addSubmitter(form.values).then((res) => {
                            notifications.show({
                                title: "Submitter added!",
                                message: res.message??"Submitter has been added successfully!",
                                color: "green",
                            })
                            queryClient.resetQueries({ queryKey: ["submitters"] })
                            setSelectedOption(res.response?.id??-1)
                            setResetOnRefetch(resetOnRefetch+1)
                            if (setAsDefaultSubmitter || !thereWhereSubmitters){
                                res.response && setDefaultSubmitter(res.response?.id).then(() => {
                                    queryClient.resetQueries({ queryKey: ["status"] })
                                })
                            }
                        }).catch((err) => {
                            notifications.show({
                                title: "Error during adding!",
                                message: err.message??"Unknown error",
                                color: "red",
                            })
                        }).finally(() => {
                            setLoader(false)
                        })
                    }
                }}
            >
                {(selectedOption==-1)?"Create":"Edit"}
            </Button>
        </Group>
        <SubmitterHelpModal open={infoModal} onClose={()=>setInfoModal(false)} />
        <TestSubmissionModal opened={submissionToTest != null} close={()=>setSubmissionToTest(undefined)} submitterId={submissionToTest??-1} />
        <YesOrNoModal open={resetAlert} onClose={()=>{setResetAlert(false)}} message="Changing submitter or closing the page you will discard all the changes done here, are you sure?" onConfirm={resetAlertAction} title="Unsaved changes!"/>
        <YesOrNoModal open={deleteSubmitterConfirm} onClose={()=>{setDeleteSubmitterConfirm(false)}} message={`Are you deleting '${form.values.name}' submitter, this action is irreversable!`} onConfirm={()=>{
            deleteSubmitter(selectedOption).then((res) => {
                notifications.show({
                    title: "Submitter deleted!",
                    message: res.message??"Submitter has been deleted successfully!",
                    color: "green",
                })
                queryClient.resetQueries({ queryKey: ["submitters"] })
                setSelectedOption(-1)
                setResetOnRefetch(resetOnRefetch+1)
            }).catch((err) => {
                notifications.show({
                    title: "Error during deletion!",
                    message: err.message??"Unknown error",
                    color: "red",
                })
            })
        }} />
        <Space h="xl" /><Space h="xl" />
    </Modal>
}