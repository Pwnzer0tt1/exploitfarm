import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css'
import '@mantine/charts/styles.css'

import { Notifications, notifications } from '@mantine/notifications';
import { AppShell, Box, Container, Divider, Image, LoadingOverlay, MantineProvider, Space, Title } from '@mantine/core';
import { LoginProvider } from '@/components/LoginProvider';
import { Routes, Route, BrowserRouter } from "react-router-dom";
import { LogoutButton, OptionButton } from '@/components/Buttons';
import { useConnectFailTimeStore, useGlobalStore, useTokenStore } from './utils/stores';
import { statusQuery } from './utils/queries';
import { HomePage } from './components/HomePage';

export default function App() {

  const loadingStatus = useGlobalStore((store) => store.loading)
  const setToken = useTokenStore((store) => store.setToken)
  const header = useGlobalStore((store) => store.header)
  const status = statusQuery()
  const isStatusError = useConnectFailTimeStore((state) => state.failed)

  return (
    <MantineProvider defaultColorScheme='dark'>
      <Notifications />
      <LoadingOverlay visible={loadingStatus || (!isStatusError && status.isLoading) } zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />
      <LoginProvider>
        <AppShell
          header={{ height: 60 }}
          navbar={{
            width: 300,
            breakpoint: 'sm',
            collapsed: { desktop: true, mobile: true },
          }}
        >
          <AppShell.Header>
            <Box style={{
              display: "flex",
              height: "100%",
              alignItems: "center"
            }}>
              <Space w="md" />
              <Image src="/logo.png" alt="ExploitFarm Logo" width={50} height={50} mih={50} miw={50} style={{marginLeft:5}}/>
              <Space w="xs" />
              <Title order={2}>
                Exploit Farm
              </Title>
              <Box style={{ flexGrow: 1 }} />
              {header}
              <OptionButton onClick={() =>{
                notifications.show({
                  title: "Implement me please :(",
                  message: "This feature is not implemented yet!",
                  color: "red",
                  autoClose: 5000
              })
              }} />
              <Space w="md" />
              {status.data?.config?.AUTHENTICATION_REQUIRED?<LogoutButton onClick={() => {
                setToken(null)
                status.refetch()
              }} />:null}
              <Space w="md" />
            </Box>
          </AppShell.Header>
          <AppShell.Main>
          <Container fluid>
              <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/:page" element={<HomePage />} />
                    <Route path="*" element={<Title order={1}>404 Not Found</Title>} />
                  </Routes>
              </BrowserRouter>
              <Divider />
              <Box className='center-flex' style={{ width: "100%", height:80 }} >
                <span>Made with ❤️ and 🚩 by <a href="https://pwnzer0tt1.it" target='_blank'>Pwnzer0tt1</a></span>
              </Box>
              <Divider />
            </Container>

          </AppShell.Main>
        </AppShell>
      </LoginProvider>
    </MantineProvider>
  )
}
