import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import '../styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error,info){console.error('Praxen Analytics: error de interfaz',error,info);}
  render(){
    if(this.state.failed)return <div className="app-fallback" role="alert">
      <div className="app-fallback-card">
        <div className="brand-symbol">P</div>
        <h1>No pudimos cargar esta pantalla</h1>
        <p>Ocurrió un problema al mostrar el panel. No se han modificado tus datos ni las sesiones guardadas.</p>
        <button className="button primary" onClick={()=>window.location.reload()}>Recargar Praxen</button>
      </div>
    </div>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<AppErrorBoundary><App/></AppErrorBoundary>);
