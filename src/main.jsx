import React from 'react';
import { createRoot } from 'react-dom/client';
import Component from './logic.js';
import renderBoard from './App.jsx';
import { createHost } from './dc.js';
import { SETTINGS } from './settings.js';
import './helmet.css';
import './pseudo.css';

const Board = createHost(Component, renderBoard);
createRoot(document.getElementById('root')).render(<Board {...SETTINGS} />);
