import React from "react";

function Home() {
  return (
    <div
      className="bg-slate-400 min-h-screen flex flex-col"
      style={{
        backgroundImage:
          'url("https://images.unsplash.com/photo-1611697522020-f44d4e818698?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <header className="bg-gray-800 text-white p-6 mb-4 text-center bg-opacity-75">
        <h1 className="text-3xl font-bold">
          Welcome to Our Teaching Platform!
        </h1>
      </header>
      <footer className="bg-gray-800 text-white text-center p-4 mt-auto bg-opacity-75">
        <p>
          &copy; {new Date().getFullYear()} Copyright Upstep Education Private
          Limited. All Rights Reserved
        </p>
      </footer>

    </div>
  );
}
export default Home;
