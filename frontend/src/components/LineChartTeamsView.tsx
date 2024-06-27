import { hashedColor } from "@/utils"
import { statsQuery, statusQuery, useTeamSolver } from "@/utils/queries"
import { getDateSmallFormatted } from "@/utils/time"
import { ChartData, ChartTooltipProps, LineChart } from "@mantine/charts"
import { Box, Divider, Paper, Space } from "@mantine/core"
import { useMemo } from "react"
import { FlagTypeControl } from "./Controllers"
import { useLocalStorage } from "@mantine/hooks"
import { FlagStatusType } from "./LineChartFlagView"


function ChartTooltip({ label, payload }: ChartTooltipProps) {
    if (!payload) return null;
    const teamSolver = useTeamSolver()
    const topTeams = 10
    return (
      <Paper px="md" py="sm" withBorder shadow="md" radius="md" style={{zIndex:2}}>
        <Box>
            <Box style={{ fontWeight: 400 }}>{label}</Box>
            <Space h="md" />
                <b>Top {topTeams} Teams:</b>
                {payload.sort((a, b) => b.value - a.value).slice(0, topTeams).map((item) => (
                <Box key={item.dataKey}>
                    <span style={{color:item.color}}>{teamSolver(item.name)}</span>: {item.value} flags
                </Box>
            ))}
            <Space h="sm" />
            <Box>...</Box>
        </Box>
      </Paper>
    );
  }

//This will be expanded in the future
export const LineChartTeamsView = ({ flagType, withControls }:{ flagType?:FlagStatusType, withControls?:boolean }) => {
    const status = statusQuery()
    const teamSolver = useTeamSolver()
    const base_secret = status.data?.server_id??"_"
    const [flagStatusFilterChart, setFlagStatusFilterChart] = useLocalStorage<FlagStatusType>({ key: "flagStatusTeamsFilter", defaultValue:flagType??"tot"})
    const finalFlagStatus = withControls?flagStatusFilterChart:(flagType??"tot")

    const series = useMemo(() => {
        return [
            { name: "null", label: "Manual", color: "gray"},
            ...status.data?.teams?.map((team) => ({ name: team.id.toString(), label: teamSolver(team.id), color: hashedColor(base_secret+team.id) }))??[]
        ]
    }, [status.isFetching])
    const stats = statsQuery()
    const useTick = status.data?.config?.START_TIME != null
    const data = useMemo(() => {
        const res = stats.data?.ticks.map((tick) => {
            let result:{ date: string, [s:string]: string|number} = { date: useTick?"Tick #"+tick.tick.toString():getDateSmallFormatted(tick.start_time) }

            Object.keys(tick.teams).forEach((id) => {
                result[id] = tick.teams[id].flags[finalFlagStatus]??0
            })
            
            return result
        })
        return res?.filter((item) => Object.keys(item).length > 1)??[]
    }, [stats.isFetching, finalFlagStatus])

    return <Box style={{width:"100%", minHeight:300}}>
        <b>Teams chart</b>
        <Space h="md" />
        <Divider />
        <Space h="lg" />
        <Space h="md" />
        <LineChart
            h={300}
            w="100%"
            data={data as ChartData}
            dataKey="date"
            series={series}
            tooltipProps={{
                content: ({ label, payload }) => <ChartTooltip label={label} payload={payload} />,
            }}
        />
        {withControls?<>
            <Space h="lg" />
            <Box className="center-flex" style={{width:"100%", flexWrap: "wrap" }}>
                <Box visibleFrom="md" style={{flexGrow:1}} />
                <FlagTypeControl value={flagStatusFilterChart} onChange={setFlagStatusFilterChart} />
            </Box>
            <Space h="lg" />
        </>:null}
    </Box>

}