import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { supabase } from "../../lib/supabase";

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState({
    title: "",
    url: "",
    info: "",
    grade: "",
    subject: "",
    level: "",
    programme: ""
  });

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    const { data, error } = await supabase.from("resources").select("*").order("title");
    if (!error) setResources(data || []);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from("resources").insert([form]).select();
    if (!error && data) {
      setResources([...resources, ...data]);
      setForm({ title: "", url: "", info: "", grade: "", subject: "", level: "", programme: "" });
    }
  };

  // Single button: push to all classes AND set as default
  const handlePushAndSetDefaults = async () => {
    await supabase.rpc("push_resources_to_classes"); // custom Postgres function
    await supabase.rpc("set_default_resources");     // custom Postgres function
    alert("Resources pushed to all current classes and set as defaults for new ones!");
  };

  return (
    <Layout>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Resource Management</h2>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 mb-8 grid grid-cols-2 gap-4">
        <input name="title" value={form.title} onChange={handleChange} placeholder="Title" className="border rounded p-2" />
        <input name="url" value={form.url} onChange={handleChange} placeholder="Link" className="border rounded p-2" />
        <textarea name="info" value={form.info} onChange={handleChange} placeholder="Additional Information" className="border rounded p-2 col-span-2" />
        <input name="grade" value={form.grade} onChange={handleChange} placeholder="Grade" className="border rounded p-2" />
        <input name="subject" value={form.subject} onChange={handleChange} placeholder="Subject" className="border rounded p-2" />
        <input name="level" value={form.level} onChange={handleChange} placeholder="Level" className="border rounded p-2" />
        <input name="programme" value={form.programme} onChange={handleChange} placeholder="Programme" className="border rounded p-2" />
        <button type="submit" className="col-span-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          Add Resource
        </button>
      </form>

      <button
        onClick={handlePushAndSetDefaults}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-8"
      >
        Push to Classes & Set Defaults
      </button>

      <div className="grid grid-cols-3 gap-4">
        {resources.map((r) => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900">{r.title}</h3>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm">{r.url}</a>
            <p className="text-gray-600 text-sm mt-2">{r.info}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 bg-gray-100 rounded">{r.grade}</span>
              <span className="px-2 py-1 bg-gray-100 rounded">{r.subject}</span>
              <span className="px-2 py-1 bg-gray-100 rounded">{r.level}</span>
              <span className="px-2 py-1 bg-gray-100 rounded">{r.programme}</span>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
