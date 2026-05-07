import Dashboard from './pages/Dashboard';
import Gym from './pages/Gym';
import Finanzas from './pages/Finanzas';
import Calendario from './pages/Calendario';
import __Layout from './Layout.jsx';

export const PAGES = {
  "Gym": Gym,
  "Finanzas": Finanzas,
  "Calendario": Calendario,
};

export const pagesConfig = {
  mainPage: null,
  Pages: PAGES,
  Layout: __Layout,
};