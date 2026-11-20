import './style.css';
import 'leaflet/dist/leaflet.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from '../components/common/ErrorBoundary';
import StandaloneReview from './StandaloneReview';
ReactDOM.createRoot(document.getElementById('app')).render(<React.StrictMode><ErrorBoundary><StandaloneReview /></ErrorBoundary></React.StrictMode>);
