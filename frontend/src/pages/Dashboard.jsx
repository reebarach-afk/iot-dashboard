import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import api from '../api';

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [device, setDevice] = useState('');
  const [chartData, setChartData] = useState([]);
  const [table, setTable] = useState({ readings: [], total: 0, limit: 10 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // load device list once
  useEffect(() => {
    api.get('/devices')
      .then(({ data }) => {
        setDevices(data);
        if (data.length) setDevice(data[0]);
      })
      .catch(() => setError('Could not load devices'));
  }, []);

  // load readings now, then every 5 seconds
  useEffect(() => {
    if (!device) return;

    const load = async () => {
      try {
        const [chart, tbl] = await Promise.all([
          api.get('/readings', { params: { device, limit: 20 } }),
          api.get('/readings', { params: { device, page, limit: 10 } }),
        ]);
        setChartData(
          [...chart.data.readings].reverse().map((r) => ({
            time: new Date(r.timestamp).toLocaleTimeString(),
            temperature: r.temperature,
            humidity: r.humidity,
          }))
        );
        setTable(tbl.data);
        setError('');
      } catch {
        setError('Could not load readings');
      }
    };

    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id); // stop polling when leaving
  }, [device, page]);

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const latest = chartData[chartData.length - 1];
  const totalPages = Math.max(Math.ceil(table.total / table.limit), 1);

  return (
    <div className="dash">
      <header>
        <h1>IoT Sensor Dashboard</h1>
        <button onClick={logout}>Logout</button>
      </header>

      {error && <p className="error">{error}</p>}

      {devices.length === 0 ? (
        <p>No devices yet. Run <code>node simulator.js</code> in the backend folder.</p>
      ) : (
        <>
          <label>
            Device:{' '}
            <select value={device}
              onChange={(e) => { setDevice(e.target.value); setPage(1); }}>
              {devices.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>

          <div className="stats">
            <div className="card">
              <small>Temperature</small>
              <h2>{latest ? `${latest.temperature} °C` : '-'}</h2>
            </div>
            <div className="card">
              <small>Humidity</small>
              <h2>{latest ? `${latest.humidity} %` : '-'}</h2>
            </div>
          </div>

          <div className="card">
            <h3>Last 20 readings</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="temperature" stroke="#e4572e" />
                <Line type="monotone" dataKey="humidity" stroke="#2e86e4" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3>All readings</h3>
            <table>
              <thead>
                <tr><th>Time</th><th>Temp (°C)</th><th>Humidity (%)</th></tr>
              </thead>
              <tbody>
                {table.readings.map((r) => (
                  <tr key={r._id}>
                    <td>{new Date(r.timestamp).toLocaleString()}</td>
                    <td>{r.temperature}</td>
                    <td>{r.humidity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pager">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}