import { useState, useEffect } from 'react'
import { StompSubscription } from '@stomp/stompjs'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import stompClient from './services/socketService'

function App() {
  const [count, setCount] = useState(0)
  const [isConnected, setIsConnected] = useState<boolean>(false)

  useEffect(() => {
    let subscription: StompSubscription | null = null;

    stompClient.onConnect = () => {
      setIsConnected(true)

      // Clean up any lingering subscriptions before creating a new one
      if (subscription) {
        subscription.unsubscribe()
      }

      subscription = stompClient.subscribe('/topic/pong', (message) => {
        alert(`Server Response: ${message.body}`)
      })
    }

    stompClient.onWebSocketClose = () => {
      setIsConnected(false)
    }

    stompClient.activate()

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
      // Detach handlers to prevent state updates on unmounted components
      stompClient.onConnect = () => {}
      stompClient.onWebSocketClose = () => {}
      stompClient.deactivate()
    }
  }, [stompClient]) // Added stompClient to the dependency array

  const handlePingPress = () => {
    if (isConnected) {
      stompClient.publish({
        destination: '/app/ping',
        body: 'Ping from React TypeScript!'
      })
    } else {
      alert('Cannot send ping. Server is disconnected.')
    }
  }

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>P2P Shopping Sync</h1>
          <p>
            WebSocket Status: <strong>{isConnected ? 'Connected' : 'Disconnected'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
          <button
            className="counter"
            onClick={handlePingPress}
            disabled={!isConnected}
          >
            Ping Server
          </button>

          <button
            className="counter"
            onClick={() => setCount((count) => count + 1)}
          >
            Count is {count}
          </button>
        </div>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank" rel="noreferrer">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank" rel="noreferrer">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App