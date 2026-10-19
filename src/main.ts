import './style.css';
import { createGame } from './game/config';
import { mountGameLayout } from './ui/layout';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Game container is missing.');

mountGameLayout(app);

createGame('game');
