import { useQuery } from "@tanstack/react-query";
import { deleteRequest, getRequest, postRequest, putRequest } from "@/utils/net";
import { paths } from "./backend_types";
import { useGlobalStore, useSettingsStore } from "./stores";
import { useMemo } from "react";
import { AttackStatuses, FlagStatuses, Stats } from "./types";

export const statusQuery = () => {
    const { statusRefreshInterval } = useSettingsStore()
    const { setErrorMessage } = useGlobalStore()
    const res = useQuery({
        queryKey: ["status"],
        queryFn: async () => {
            return await getRequest("/status") as paths["/api/status"]["get"]["responses"][200]["content"]["application/json"]
        },
        refetchInterval: statusRefreshInterval,
        retry(_fail, error) {
            setErrorMessage({
                title: "BACKEND SEEMS DOWN!",
                message: "Can't connect to backend APIs: "+error.message,
                color: "red"
            })
            return true
        },
        retryDelay: 5000
    })
    return res
}

type AttackRequestOptions = {
    id?: number,
    status?: AttackStatuses,
    target?: number,
    exploit?: string,
    executed_by?: string,
    reversed?: boolean
}

type FlagsRequestOptions = {
    id?: number,
    flag_status?: FlagStatuses,
    attack_status?: AttackStatuses,
    target?: number,
    exploit?: string,
    executed_by?: string,
    reversed?: boolean
}

export const flagsRequest = async (page:number, pageSize: number, others:FlagsRequestOptions = {}) => {
    return await getRequest("/flags",{
        params: {
            page: page,
            size: pageSize,
            ...others
        }
    }) as paths["/api/flags"]["get"]["responses"][200]["content"]["application/json"]
}

export const flagsQuery = (page:number, options:FlagsRequestOptions = {}) => {
    const [pageSizeRequest, refreshDataTime] = useSettingsStore((state) => [state.tablePageSize, state.refreshInterval])
    return useQuery({
        queryKey: ["flags", options, pageSizeRequest, page],
        queryFn: async () => await flagsRequest(page, pageSizeRequest, options),
        refetchInterval: refreshDataTime
    })
}

export const deleteTeamList = async (teams: number[]) => {
    return await postRequest("/teams/delete", { body: teams }) as paths["/api/teams/delete"]["post"]["responses"][200]["content"]["application/json"]
}

export const editTeamList = async (teams: {[k:string]:any}) => {
    return await putRequest("/teams", { body: teams }) as paths["/api/teams"]["put"]["responses"][200]["content"]["application/json"]
}

export const addTeamList = async (teams: {[k:string]:any}) => {
    return await postRequest("/teams", { body: teams }) as paths["/api/teams"]["post"]["responses"][200]["content"]["application/json"]
}

export const deleteClient = async (clientId: string) => {
    return await deleteRequest("/clients/"+clientId) as paths["/api/clients/{client_id}"]["delete"]["responses"][200]["content"]["application/json"]
}

export const addService = async (values:{[k:string]:any}) => {
    return await postRequest("/services", { body: values }) as paths["/api/services"]["post"]["responses"][200]["content"]["application/json"]
}

export const editService = async (serviceId: string, values:{[k:string]:any}) => {
    return await putRequest("/services/"+serviceId, { body: values }) as paths["/api/services/{service_id}"]["put"]["responses"][200]["content"]["application/json"]
}

export const deleteService = async (serviceId: string) => {
    return await deleteRequest("/services/"+serviceId) as paths["/api/services/{service_id}"]["delete"]["responses"][200]["content"]["application/json"]
}

export const editClient = async (clientId: string, values:{[k:string]:any}) => {
    return await putRequest("/clients/"+clientId, { body: values }) as paths["/api/clients/{client_id}"]["put"]["responses"][200]["content"]["application/json"]
}

export const deleteExploit = async (exploitId: string) => {
    return await deleteRequest("/exploits/"+exploitId) as paths["/api/exploits/{exploit_id}"]["delete"]["responses"][200]["content"]["application/json"]
}

export const editExploit = async (exploitId: string, values:{[k:string]:any}) => {
    return await putRequest("/exploits/"+exploitId, { body: values }) as paths["/api/exploits/{exploit_id}"]["put"]["responses"][200]["content"]["application/json"]
}

export const attackRequest = async (page:number, pageSize: number, others:AttackRequestOptions = {}) => {
    return await getRequest("/flags/attacks", {
        params: {
            page: page,
            size: pageSize,
            ...others
        }
    }) as paths["/api/flags/attacks"]["get"]["responses"][200]["content"]["application/json"]
}

export const attacksQuery = (page:number, options:AttackRequestOptions = {}) => {
    const [pageSizeRequest, refreshDataTime] = useSettingsStore((state) => [state.tablePageSize, state.refreshInterval])
    return useQuery({
        queryKey: ["attacks", options, pageSizeRequest, page],
        queryFn: async () => await attackRequest(page, pageSizeRequest, options),
        refetchInterval: refreshDataTime
    })
}

export const setSetup = async (values:{[k:string]:any}) => {
    return await postRequest("/setup", { body: values }) as paths["/api/setup"]["post"]["responses"][200]["content"]["application/json"]
}

export const commitManualSubmission = async (flag_text:string) => {
    return await postRequest("/exploits/submit", {
        body: { output: flag_text }
    }) as paths["/api/exploits/submit"]["post"]["responses"][200]["content"]["application/json"]
}

export const exploitsQuery = () => {
    const refreshDataTime = useSettingsStore((state) => state.refreshInterval)
    return useQuery({
        queryKey: ["exploits"],
        queryFn: async () => await getRequest("/exploits") as paths["/api/exploits"]["get"]["responses"][200]["content"]["application/json"],
        refetchInterval: refreshDataTime
    })
}

export const submittersQuery = () => {
    const refreshDataTime = useSettingsStore((state) => state.refreshInterval)
    return useQuery({
        queryKey: ["submitters"],
        queryFn: async () => await getRequest("/submitters") as paths["/api/submitters"]["get"]["responses"][200]["content"]["application/json"],
        refetchInterval: refreshDataTime
    })
}

export const clientsQuery = () => {
    const refreshDataTime = useSettingsStore((state) => state.refreshInterval)
    return useQuery({
        queryKey: ["clients"],
        queryFn: async () => await getRequest("/clients") as paths["/api/clients"]["get"]["responses"][200]["content"]["application/json"],
        refetchInterval: refreshDataTime
    })
}

export const statsQuery = () => {
    const refreshDataTime = useSettingsStore((state) => state.refreshInterval)
    return useQuery({
        queryKey: ["flags", "stats"],
        queryFn: async () => await getRequest("/flags/stats") as Stats,
        refetchInterval: refreshDataTime
    })
}

export const useServiceMapping = () => {
    const status = statusQuery()
    return useMemo(() => {
        const services = status.data?.services?.map((service) => ({[service.id]: service}))
        if (services == null || services.length == 0) return {}
        return services.reduce((acc, val) => ({...acc, ...val}), {})
    }, [status.isFetching])
}

export const useTeamMapping = () => {
    const status = statusQuery()
    return useMemo(() => {
        const teams = status.data?.teams?.map((team) => ({[team.id]: team}))
        if (teams == null || teams.length == 0) return {}
        return teams.reduce((acc, val) => ({...acc, ...val}), {})
    }, [status.isFetching])
}

export const useExploitMapping = () => {
    const exploits = exploitsQuery()
    return useMemo(() => {
        const exp = exploits.data?.map((exploit) => ({[exploit.id]: exploit}))
        if (exp == null || exp.length == 0) return {}
        return exp.reduce((acc, val) => ({...acc, ...val}), {})
    }, [exploits.isFetching])
}

export const useClientMapping = () => {
    const clients = clientsQuery()
    return useMemo(() => {
        const cl = clients.data?.map((client) => ({[client.id]: client}))
        if (cl == null || cl.length == 0) return {}
        return cl.reduce((acc, val) => ({...acc, ...val}), {})
    }, [clients.isFetching])
}

export const useServiceSolver = () => {
    const services = useServiceMapping()
    return (id?:string|null) => {
        if (id == null) return "Unknown"
        const service = services[id]
        if (service == null) return `Service ${id}`
        return service.name
    }
}

export const useServiceSolverByExploitId = () => {
    const services = useServiceMapping()
    const exploits = useExploitMapping()
    return (id?:string|null) => {
        if (id == null) return "Unknown"
        const exploit = exploits[id]
        if (exploit == null) return `Exploit ${id}`
        const service = services[exploit.service]
        if (service == null) return `Service ${exploit.service}`
        return service.name
    }
}

export const useTeamSolver = () => {
    const teams = useTeamMapping()
    return (id?:number|null) => {
        if (id == null) return "Unknown"
        const team = teams[id]
        if (team == null) return `Team ${id}`
        if (team.name != null) return team.name
        if (team.short_name != null) return team.short_name
        return `Team ${team.host}`
    }
}

export const useExploitSolver = () => {
    const exploits = useExploitMapping()
    return (id?:string|null) => {
        if (id == null) return "Unknown"
        const exploit = exploits[id]
        if (exploit == null) return `Exploit ${id}`
        return exploit.name
    }
}

export const useClientSolver = () => {
    const clients = useClientMapping()
    return (id?:string|null) => {
        if (id == null) return "Unknown"
        const client = clients[id]
        if (client == null) return `Client ${id}`
        return client.name
    }
}

export const useExtendedExploitSolver = () => {
    const exploits = useExploitMapping()
    const services = useServiceMapping()
    return (id?:string|null) => {
        if (id == null) return "Unknown"
        const exploit = exploits[id]
        if (exploit == null) return `Exploit ${id}`
        return <span>
            <b>{services[exploit.service]?.name??`Service ${exploit.service}`}</b> ({exploit.name})
        </span>
    }
}

export const checkSubmitterCode = async (code: string) => {
    return await postRequest("/submitters/check", { body: { code } }) as paths["/api/submitters/check"]["post"]["responses"][200]["content"]["application/json"]
}

export const editSubmitter = async (submitterId: number, values:{[k:string]:any}) => {
    return await putRequest("/submitters/"+submitterId, { body: values }) as paths["/api/submitters/{submitter_id}"]["put"]["responses"][200]["content"]["application/json"]
}

export const addSubmitter = async (values:{[k:string]:any}) => {
    return await postRequest("/submitters", { body: values }) as paths["/api/submitters"]["post"]["responses"][200]["content"]["application/json"]
}

export const deleteSubmitter = async (submitterId: number) => {
    return await deleteRequest("/submitters/"+submitterId) as paths["/api/submitters/{submitter_id}"]["delete"]["responses"][200]["content"]["application/json"]
}

export const testSubmitter = async (submitterId: number, data: string) => {
    return await postRequest("/submitters/"+submitterId.toString()+"/test", { body: [data]}) as paths["/api/submitters/{submitter_id}/test"]["post"]["responses"][200]["content"]["application/json"]
}
