
import { useState } from "react";
import "./App.css";

const initialMachines = [
  {
    id: 1,
    name: "Mill 1",
    status: "Running",
    jobNumber: "1042",
    partNumber: "P-1001",
    completed: 35,
    required: 50,
  },
  {
    id: 2,
    name: "Mill 2",
    status: "Setup",
    jobNumber: "2081",
    partNumber: "P-2001",
    completed: 0,
    required: 25,
  },
  {
    id: 3,
    name: "Mill 3",
    status: "Running",
    jobNumber: "3011",
    partNumber: "P-3001",
    completed: 18,
    required: 30,
  },
  {
    id: 4,
    name: "Mill 4",
    status: "Stopped",
    jobNumber: "4020",
    partNumber: "P-4001",
    completed: 12,
    required: 40,
  },
  {
    id: 5,
    name: "Mill 5",
    status: "Running",
    jobNumber: "5011",
    partNumber: "P-5001",
    completed: 45,
    required: 50,
  },
];

function App() {
  const [machines, setMachines] = useState(initialMachines);

  const updateStatus = (id, newStatus) => {
    setMachines((currentMachines) =>
      currentMachines.map((machine) =>
        machine.id === id
          ? { ...machine, status: newStatus }
          : machine
      )
    );
  };

  const running = machines.filter(
    (machine) => machine.status === "Running"
  ).length;

  const setup = machines.filter(
    (machine) => machine.status === "Setup"
  ).length;

  const stopped = machines.filter(
    (machine) => machine.status === "Stopped"
  ).length;

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>⚙ ShopFloor</h2>
        <p className="sidebar-label">WORKSPACE</p>
        <nav>
          <a className="active" href="#">Dashboard</a>
          <a href="#">Machines</a>
          <a href="#">Production</a>
          <a href="#">Reports</a>
        </nav>
        <div className="sidebar-footer">
          CNC Production Management
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Production Dashboard</h1>
            <p>Monitor your shop floor activity</p>
          </div>
          <div className="demo-label">DEMO ENVIRONMENT</div>
        </header>

        <section className="summary-grid">
          <SummaryCard label="Total Machines" value={machines.length} />
          <SummaryCard label="Running" value={running} />
          <SummaryCard label="Setup" value={setup} />
          <SummaryCard label="Stopped" value={stopped} />
        </section>

        <section className="machine-section">
          <div className="section-heading">
            <div>
              <h2>Machine Overview</h2>
              <p>Current machine and job assignments</p>
            </div>
            <span>{machines.length} Machines</span>
          </div>

          <div className="machine-grid">
            {machines.map((machine) => {
              const progress = Math.round(
                (machine.completed / machine.required) * 100
              );

              return (
                <article className="machine-card" key={machine.id}>
                  <div className="card-heading">
                    <h3>{machine.name}</h3>
                    <span
                      className={`status ${machine.status.toLowerCase()}`}
                    >
                      {machine.status}
                    </span>
                  </div>

                  <div className="job-info">
                    <div>
                      <span>Job Number</span>
                      <strong>{machine.jobNumber}</strong>
                    </div>
                    <div>
                      <span>Part Number</span>
                      <strong>{machine.partNumber}</strong>
                    </div>
                  </div>

                  <div className="production-info">
                    <div className="progress-heading">
                      <span>Production Progress</span>
                      <strong>{progress}%</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p>
                      {machine.completed} of {machine.required} parts
                    </p>
                  </div>

                  <div className="status-control">
                    <label htmlFor={`status-${machine.id}`}>
                      Update Status
                    </label>
                    <select
                      id={`status-${machine.id}`}
                      value={machine.status}
                      onChange={(event) =>
                        updateStatus(machine.id, event.target.value)
                      }
                    >
                      <option>Running</option>
                      <option>Setup</option>
                      <option>Idle</option>
                      <option>Stopped</option>
                    </select>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
