import { BrowserRouter } from 'react-router-dom';
import { SessionBootstrap } from './components/SessionBootstrap';
import { RealtimeProvider } from './components/RealtimeProvider';
import { ToastContainer } from './components/ToastContainer';
import { AppRoutes } from './AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <RealtimeProvider>
          <AppRoutes />
        </RealtimeProvider>
      </SessionBootstrap>
      <ToastContainer />
    </BrowserRouter>
  );
}
