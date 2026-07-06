import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { AgentIdentity } from "../types";

interface FarmFormsProps {
  agentIdentity: AgentIdentity;
  dynamicClusters: string[];
  users?: AgentIdentity[];
  onFormSubmitted?: () => void;
}

function getDistanceFromLatLonInM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

const FarmForms: React.FC<FarmFormsProps> = ({
  agentIdentity,
  dynamicClusters,
  users = [],
  onFormSubmitted,
}) => {
  const [activeForm, setActiveForm] = useState<
    "weekly" | "solidarity" | "homestead" | "youth_assessment"
  >("weekly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | "loading";
    message: string;
  } | null>(null);
  const [farmBaselines, setFarmBaselines] = useState<any[]>([]);

  // Youth Assessment Form Custom States
  const [youthList, setYouthList] = useState<{ name: string; sex: string; mobile: string; grade: string }[]>([
    { name: '', sex: 'M', mobile: '', grade: '' }
  ]);
  const [otherMemberList, setOtherMemberList] = useState<{ name: string; sex: string; mobile: string; relation: string }[]>([
    { name: '', sex: 'M', mobile: '', relation: '' }
  ]);
  const [seedsList, setSeedsList] = useState<{ cropSeed: string; livestockSeed: string }[]>([
    { cropSeed: '', livestockSeed: '' }
  ]);
  const [foodsList, setFoodsList] = useState<{ cropFood: string; livestockFood: string }[]>([
    { cropFood: '', livestockFood: '' }
  ]);
  const [organicInputsList, setOrganicInputsList] = useState<{ type: string; quantity: string }[]>([
    { type: '', quantity: '' }
  ]);
  const [implementsList, setImplementsList] = useState<{ type: string; quantity: string }[]>([
    { type: '', quantity: '' }
  ]);
  const [consumptionList, setConsumptionList] = useState<{ type: string; source: string }[]>([
    { type: '', source: '' }
  ]);

  // Signatures
  const [parentName, setParentName] = useState('');
  const [parentAttested, setParentAttested] = useState(false);
  const [parentSignedAt, setParentSignedAt] = useState('');

  const [salesAgentName, setSalesAgentName] = useState('');
  const [salesAgentAttested, setSalesAgentAttested] = useState(false);
  const [salesAgentSignedAt, setSalesAgentSignedAt] = useState('');

  const [youthAgentName, setYouthAgentName] = useState('');
  const [youthAgentAttested, setYouthAgentAttested] = useState(false);
  const [youthAgentSignedAt, setYouthAgentSignedAt] = useState('');

  // Auto-timestamp signatures when name is typed
  useEffect(() => {
    if (parentName) {
      if (!parentSignedAt) {
        setParentSignedAt(new Date().toLocaleString());
      }
    } else {
      setParentSignedAt('');
    }
  }, [parentName]);

  useEffect(() => {
    if (salesAgentName) {
      if (!salesAgentSignedAt) {
        setSalesAgentSignedAt(new Date().toLocaleString());
      }
    } else {
      setSalesAgentSignedAt('');
    }
  }, [salesAgentName]);

  useEffect(() => {
    if (youthAgentName) {
      if (!youthAgentSignedAt) {
        setYouthAgentSignedAt(new Date().toLocaleString());
      }
    } else {
      setYouthAgentSignedAt('');
    }
  }, [youthAgentName]);

  const resetCustomForm = () => {
    setYouthList([{ name: '', sex: 'M', mobile: '', grade: '' }]);
    setOtherMemberList([{ name: '', sex: 'M', mobile: '', relation: '' }]);
    setSeedsList([{ cropSeed: '', livestockSeed: '' }]);
    setFoodsList([{ cropFood: '', livestockFood: '' }]);
    setOrganicInputsList([{ type: '', quantity: '' }]);
    setImplementsList([{ type: '', quantity: '' }]);
    setConsumptionList([{ type: '', source: '' }]);
    setParentName('');
    setParentAttested(false);
    setParentSignedAt('');
    setSalesAgentName('');
    setSalesAgentAttested(false);
    setSalesAgentSignedAt('');
    setYouthAgentName('');
    setYouthAgentAttested(false);
    setYouthAgentSignedAt('');
  };

  useEffect(() => {
    supabase
      .from("farm_baselines")
      .select("*")
      .eq("farmer_phone", agentIdentity.phone)
      .then(({ data }) => {
        if (data) setFarmBaselines(data);
      });
  }, [agentIdentity.phone]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: "loading", message: "Verifying GPS location..." });

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Handle checkboxes
      const workDone = formData.getAll("workDone");
      if (workDone.length > 0) {
        data.workDone = workDone as any;
      }

      // Capture GPS location
      let location: { lat: number; lng: number } | null = null;
      try {
        location = await new Promise((resolve, reject) => {
          let timeoutId: any;
          
          if (!navigator.geolocation) {
            return reject(new Error("Geolocation not supported."));
          }
          
          timeoutId = setTimeout(() => {
            reject(new Error("Geolocation request timed out. Please check browser permissions."));
          }, 8000);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeoutId);
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (err) => {
              clearTimeout(timeoutId);
              reject(err);
            },
            { timeout: 8000, enableHighAccuracy: true }
          );
        });
      } catch (geoErr) {
        console.warn("Could not get location:", geoErr);
        // Do not throw, just allow submission without verified GPS
        // We will log it as unverified
      }

      let confirmationMessage = "Form submitted successfully.";
      data.gpsVerificationStatus = "Not Verified";

      // Verify location against farm baselines
      // Fetch baselines for THIS specific farmer if they are not the agent so we don't accidentally fail
      const targetPhone = data.homesteadContact || data.productionOfficerContact || data.convenerContact || data.mobileNumber || agentIdentity.phone;
      let targetBaselines = farmBaselines;
      if (targetPhone && targetPhone !== agentIdentity.phone) {
        try {
          const { data: remoteBaselines } = await supabase
             .from("farm_baselines")
             .select("*")
             .eq("farmer_phone", targetPhone);
          if (remoteBaselines) targetBaselines = remoteBaselines;
        } catch(e) {}
      }

      if (targetBaselines.length > 0 && location) {
        let isVerified = false;
        for (const farm of targetBaselines) {
          if (farm.latitude && farm.longitude) {
            const distance = getDistanceFromLatLonInM(
              location.lat,
              location.lng,
              farm.latitude,
              farm.longitude,
            );
            const sizeInAcres = farm.size_in_acres || 1; // Default to 1 acre
            // 1 acre = ~4046 sq meters -> radius = sqrt(4046 / pi) = ~36m. Add 50m buffer.
            const allowedRadius =
              Math.sqrt((sizeInAcres * 4046) / Math.PI) + 50;
            if (distance <= allowedRadius) {
              isVerified = true;
              data.verifiedFarmId = farm.id;
              data.verifiedFarmName = farm.farm_name;
              break;
            }
          }
        }
        if (!isVerified) {
          data.verifiedFarmId = "unverified (distance mismatch)";
          data.gpsVerificationStatus = "GPS Not Verified";
          confirmationMessage = "Form submitted successfully! (GPS Not Verified - Away from location)";
        } else {
          data.gpsVerificationStatus = "GPS Verified";
          confirmationMessage = "Form submitted successfully! (GPS Verified)";
        }
      } else if (targetBaselines.length === 0) {
        // No farms registered, skip verification but allow submission? Or block?
        // We will allow but flag unverified.
        data.verifiedFarmId = "unverified (no baseline)";
        data.gpsVerificationStatus = "GPS Not Verified";
        confirmationMessage = "Form submitted successfully! (GPS Not Verified - No registered location)";
      } else if (!location) {
        data.verifiedFarmId = "unverified (no gps)";
        data.gpsVerificationStatus = "GPS Not Verified";
        confirmationMessage = "Form submitted successfully! (GPS Not Verified - Unable to capture GPS)";
      }

      // Signature and Attestation Validation for Youth Assessment
      if (activeForm === "youth_assessment") {
        if (!parentAttested || !parentName.trim()) {
          throw new Error("Please type your name and check the box to sign the Parent/Guardian Electronic Attestation.");
        }
        if (!salesAgentName.trim()) {
          throw new Error("Please select the Sales Agent.");
        }
        if (!youthAgentAttested || !youthAgentName.trim()) {
          throw new Error("Please type your name and check the box to sign the Youth Agent Confirmation Electronic Attestation.");
        }
      }

      const payload = {
        id: `farm_form_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        title: `FarmForm_${activeForm}`,
        content: JSON.stringify({
          ...data,
          formType: activeForm,
          location,
          submittedAt: new Date().toISOString(),
          agentCluster: agentIdentity.cluster,
          farmerPhone: activeForm === "youth_assessment" 
            ? (data.parentPhone || agentIdentity.phone) 
            : (data.homesteadContact || data.productionOfficerContact || data.convenerContact || agentIdentity.phone),
          submittedByPhone: agentIdentity.phone, // Track who actually submitted it
          ...(activeForm === "youth_assessment" ? {
            youthList,
            otherMemberList,
            seedsList,
            foodsList,
            organicInputsList,
            implementsList,
            consumptionList,
            parentName,
            parentSignedAt,
            salesAgentName,
            salesAgentSignedAt,
            youthAgentName,
            youthAgentSignedAt,
            parentAttested,
            salesAgentAttested,
            youthAgentAttested
          } : {})
        }),
      };

      const { error } = await supabase.from("pages").insert(payload);
      if (error) throw error;

      setSubmitStatus({
        type: "success",
        message: confirmationMessage,
      });
      form.reset();
      if (activeForm === "youth_assessment") {
        resetCustomForm();
      }
      if (onFormSubmitted) onFormSubmitted();

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSubmitStatus(null), 5000);
    } catch (error: any) {
      console.error("Error submitting form:", error);
      setSubmitStatus({
        type: "error",
        message: error.message || "Failed to submit form. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <datalist id="homestead-list">
        {users
          .filter((u) => u.homesteadName || u.name)
          .map((u, i) => (
            <option key={i} value={u.homesteadName || u.name} />
          ))}
      </datalist>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">
          Farm Activity & Solidarity Forms
        </h2>

        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveForm("weekly")}
            className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeForm === "weekly" ? "bg-emerald-600 text-white shadow-lg" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Weekly Farm Activity
          </button>
          <button
            onClick={() => setActiveForm("solidarity")}
            className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeForm === "solidarity" ? "bg-emerald-600 text-white shadow-lg" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Labor Solidarity (Form A)
          </button>
          <button
            onClick={() => setActiveForm("homestead")}
            className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeForm === "homestead" ? "bg-emerald-600 text-white shadow-lg" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Homestead Owner (Form B)
          </button>
          <button
            onClick={() => {
              setActiveForm("youth_assessment");
              resetCustomForm();
            }}
            className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeForm === "youth_assessment" ? "bg-emerald-600 text-white shadow-lg" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Youth Assessment (Form C)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {activeForm === "weekly" && (
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-6">
              <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest mb-2">
                Weekly Farm Activities Capture Form
              </h3>
              <p className="text-[11px] font-bold text-emerald-700 italic">
                Farm - means Homestead or Household including all the activities
                like ploughing, weeding etc that goes on in the farm
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {submitStatus && (
              <div
                className={`col-span-1 md:col-span-2 p-4 rounded-xl text-sm font-bold flex items-center gap-3 ${
                  submitStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : submitStatus.type === "loading"
                    ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                <i
                  className={`fas ${submitStatus.type === "success" ? "fa-check-circle" : submitStatus.type === "loading" ? "fa-circle-notch fa-spin" : "fa-exclamation-triangle"}`}
                ></i>
                {submitStatus.message}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                Date of Activity
              </label>
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
              />
            </div>

            {activeForm !== "youth_assessment" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                  Food Coop
                </label>
                <select
                  name="foodCoop"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all appearance-none"
                  defaultValue={agentIdentity.cluster}
                >
                  {dynamicClusters.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeForm === "solidarity" ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                  Type of Work Done
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  {[
                    "Ploughing",
                    "Planting",
                    "Weeding",
                    "Harvesting",
                    "Slashing",
                    "Washing",
                    "Sweeping",
                    "Fetching water",
                    "Watering crops",
                    "Feeding animals",
                    "Other",
                  ].map((work) => (
                    <label
                      key={work}
                      className="flex items-center space-x-3 cursor-pointer group"
                    >
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          name="workDone"
                          value={work}
                          className="peer sr-only"
                        />
                        <div className="w-6 h-6 rounded-lg border-2 border-slate-300 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                          <i className="fas fa-check text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                        {work}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                  Names and Contacts of Participants
                </label>
                <textarea
                  name="participants"
                  rows={5}
                  required
                  placeholder="List the names and contacts of all participants here..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
                ></textarea>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                  Homestead Owner
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      Name of Homestead Visited
                    </label>
                    <input
                      type="text"
                      name="homesteadVisitedName"
                      list="homestead-list"
                      required
                      placeholder="Enter homestead name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                      onChange={(e) => {
                        const match = users.find(
                          (u) => (u.homesteadName || u.name) === e.target.value,
                        );
                        if (match) {
                          const contactInput =
                            e.target.form?.elements.namedItem(
                              "homesteadVisitedContact",
                            ) as HTMLInputElement;
                          if (contactInput) contactInput.value = match.phone;
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      Contact of Homestead Visited
                    </label>
                    <input
                      type="text"
                      name="homesteadVisitedContact"
                      required
                      placeholder="Enter homestead contact"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : activeForm === "homestead" ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    Name of Food Coop Production Officer
                  </label>
                  <input
                    type="text"
                    name="productionOfficerName"
                    required
                    placeholder="Enter officer name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    Contact of Food Coop Production Officer
                  </label>
                  <input
                    type="text"
                    name="productionOfficerContact"
                    required
                    placeholder="Enter officer contact"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    Name of Homestead Visited
                  </label>
                  <input
                    type="text"
                    name="homesteadVisitedName"
                    list="homestead-list"
                    required
                    placeholder="Enter homestead name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    Name of Homestead Convener
                  </label>
                  <input
                    type="text"
                    name="convenerName"
                    list="homestead-list"
                    required
                    placeholder="Enter convener name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                    onChange={(e) => {
                      const match = users.find(
                        (u) => (u.homesteadName || u.name) === e.target.value,
                      );
                      if (match) {
                        const contactInput = e.target.form?.elements.namedItem(
                          "convenerContact",
                        ) as HTMLInputElement;
                        if (contactInput) contactInput.value = match.phone;
                        // Autofill homestead name if it's the same
                        const nameInput = e.target.form?.elements.namedItem(
                          "homesteadVisitedName",
                        ) as HTMLInputElement;
                        if (
                          nameInput &&
                          !nameInput.value &&
                          match.homesteadName
                        )
                          nameInput.value = match.homesteadName;
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    Contact of Homestead Convener
                  </label>
                  <input
                    type="text"
                    name="convenerContact"
                    required
                    placeholder="Enter convener contact"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                  Type of Work Done
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  {[
                    "Ploughing",
                    "Planting",
                    "Weeding",
                    "Harvesting",
                    "Slashing",
                    "Washing",
                    "Sweeping",
                    "Fetching water",
                    "Watering crops",
                    "Feeding animals",
                    "Other",
                  ].map((work) => (
                    <label
                      key={work}
                      className="flex items-center space-x-3 cursor-pointer group"
                    >
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          name="workDone"
                          value={work}
                          className="peer sr-only"
                        />
                        <div className="w-6 h-6 rounded-lg border-2 border-slate-300 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                          <i className="fas fa-check text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                        {work}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                  Total Number of Participants
                </label>
                <input
                  type="number"
                  name="totalParticipants"
                  min="1"
                  required
                  placeholder="e.g. 5"
                  className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                />
              </div>
            </div>
          ) : activeForm === "youth_assessment" ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Section 1.0 Household Details */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                  <i className="fas fa-home text-emerald-600"></i> 1.0 Household Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      1.1 Household Name
                    </label>
                    <input
                      type="text"
                      name="householdName"
                      required
                      placeholder="Enter Household Name"
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      1.2 Food Coop Name
                    </label>
                    <select
                      name="foodCoopName"
                      required
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all text-xs"
                      defaultValue={agentIdentity.cluster}
                    >
                      <option value="">Select Food Coop</option>
                      {dynamicClusters.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 1.3 Parents/Guardians Details */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-user-shield text-emerald-600"></i> 1.3 Parents/Guardians Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                        Name of Parent/Guardian
                      </label>
                      <input
                        type="text"
                        name="parentNameField"
                        required
                        placeholder="Full Name"
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                        Sex
                      </label>
                      <select
                        name="parentSex"
                        required
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all text-xs"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        name="parentPhone"
                        required
                        placeholder="e.g. +254..."
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                        National / Student ID
                      </label>
                      <input
                        type="text"
                        name="parentId"
                        required
                        placeholder="ID Number"
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 1.4 Household Youth Details Table */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-child text-emerald-600"></i> 1.4 Household Youth Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => setYouthList([...youthList, { name: '', sex: 'M', mobile: '', grade: '' }])}
                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                  >
                    <i className="fas fa-plus"></i> Add Youth
                  </button>
                </div>
                <div className="space-y-4">
                  {youthList.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Youth Name</label>
                        <input
                          type="text"
                          required
                          value={row.name}
                          onChange={(e) => {
                            const updated = [...youthList];
                            updated[index].name = e.target.value;
                            setYouthList(updated);
                          }}
                          placeholder="Name"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Sex</label>
                        <select
                          value={row.sex}
                          onChange={(e) => {
                            const updated = [...youthList];
                            updated[index].sex = e.target.value;
                            setYouthList(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                        >
                          <option value="M">Male (M)</option>
                          <option value="F">Female (F)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Mobile Number</label>
                        <input
                          type="text"
                          required
                          value={row.mobile}
                          onChange={(e) => {
                            const updated = [...youthList];
                            updated[index].mobile = e.target.value;
                            setYouthList(updated);
                          }}
                          placeholder="Mobile"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Grade / Level</label>
                          <input
                            type="text"
                            required
                            value={row.grade}
                            onChange={(e) => {
                              const updated = [...youthList];
                              updated[index].grade = e.target.value;
                              setYouthList(updated);
                            }}
                            placeholder="e.g. Grade 10"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                          />
                        </div>
                        {youthList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setYouthList(youthList.filter((_, i) => i !== index))}
                            className="bg-red-50 text-red-500 hover:bg-red-100 p-2.5 rounded-xl transition-all mb-0.5"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 1.5 Other Household Members Details */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-users-rectangle text-emerald-600"></i> 1.5 Other Household Members Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOtherMemberList([...otherMemberList, { name: '', sex: 'M', mobile: '', relation: '' }])}
                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                  >
                    <i className="fas fa-plus"></i> Add Member
                  </button>
                </div>
                <div className="space-y-4">
                  {otherMemberList.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Member Name</label>
                        <input
                          type="text"
                          required
                          value={row.name}
                          onChange={(e) => {
                            const updated = [...otherMemberList];
                            updated[index].name = e.target.value;
                            setOtherMemberList(updated);
                          }}
                          placeholder="Name"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Sex</label>
                        <select
                          value={row.sex}
                          onChange={(e) => {
                            const updated = [...otherMemberList];
                            updated[index].sex = e.target.value;
                            setOtherMemberList(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                        >
                          <option value="M">Male (M)</option>
                          <option value="F">Female (F)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Mobile Number</label>
                        <input
                          type="text"
                          required
                          value={row.mobile}
                          onChange={(e) => {
                            const updated = [...otherMemberList];
                            updated[index].mobile = e.target.value;
                            setOtherMemberList(updated);
                          }}
                          placeholder="Mobile"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Relation</label>
                          <input
                            type="text"
                            required
                            value={row.relation}
                            onChange={(e) => {
                              const updated = [...otherMemberList];
                              updated[index].relation = e.target.value;
                              setOtherMemberList(updated);
                            }}
                            placeholder="e.g. Uncle / Aunt / Cousin / Worker"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                          />
                        </div>
                        {otherMemberList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setOtherMemberList(otherMemberList.filter((_, i) => i !== index))}
                            className="bg-red-50 text-red-500 hover:bg-red-100 p-2.5 rounded-xl transition-all mb-0.5"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2.0 Crops & Animals Details */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                  <i className="fas fa-paw text-emerald-600"></i> 2.0 Crops & Animals Details
                </h3>

                {/* 2.2 Indigenous Seeds */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                      <i className="fas fa-seedling text-emerald-600"></i> 2.2 Indigenous Crop & Livestock Seeds Available
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSeedsList([...seedsList, { cropSeed: '', livestockSeed: '' }])}
                      className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                    >
                      <i className="fas fa-plus"></i> Add Seed Row
                    </button>
                  </div>
                  <div className="space-y-3">
                    {seedsList.map((row, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-100 relative">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Crop Seed Type/Variety</label>
                          <input
                            type="text"
                            required
                            value={row.cropSeed}
                            onChange={(e) => {
                              const updated = [...seedsList];
                              updated[index].cropSeed = e.target.value;
                              setSeedsList(updated);
                            }}
                            placeholder="e.g. Indigenous Maize variety"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                          />
                        </div>
                        <div className="space-y-1 flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Livestock Seed Type/Breed</label>
                            <input
                              type="text"
                              required
                              value={row.livestockSeed}
                              onChange={(e) => {
                                const updated = [...seedsList];
                                updated[index].livestockSeed = e.target.value;
                                setSeedsList(updated);
                              }}
                              placeholder="e.g. Indigenous chicken breed"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                            />
                          </div>
                          {seedsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSeedsList(seedsList.filter((_, i) => i !== index))}
                              className="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-xl transition-all mb-0.5"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2.3 Indigenous Food */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                      <i className="fas fa-bowl-food text-emerald-600"></i> 2.3 Indigenous Crops & Livestock Food Available
                    </h4>
                    <button
                      type="button"
                      onClick={() => setFoodsList([...foodsList, { cropFood: '', livestockFood: '' }])}
                      className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                    >
                      <i className="fas fa-plus"></i> Add Food Row
                    </button>
                  </div>
                  <div className="space-y-3">
                    {foodsList.map((row, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-100 relative">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Crop Food Type/Variety</label>
                          <input
                            type="text"
                            required
                            value={row.cropFood}
                            onChange={(e) => {
                              const updated = [...foodsList];
                              updated[index].cropFood = e.target.value;
                              setFoodsList(updated);
                            }}
                            placeholder="e.g. Cassava, Sweet potatoes"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                          />
                        </div>
                        <div className="space-y-1 flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Livestock Food Type/Breed</label>
                            <input
                              type="text"
                              required
                              value={row.livestockFood}
                              onChange={(e) => {
                                const updated = [...foodsList];
                                updated[index].livestockFood = e.target.value;
                                setFoodsList(updated);
                              }}
                              placeholder="e.g. Free-range eggs, Goat milk"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                            />
                          </div>
                          {foodsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFoodsList(foodsList.filter((_, i) => i !== index))}
                              className="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-xl transition-all mb-0.5"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2.4 Organic Farm Inputs */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                      <i className="fas fa-flask text-emerald-600"></i> 2.4 Organic Farm Inputs Available
                    </h4>
                    <button
                      type="button"
                      onClick={() => setOrganicInputsList([...organicInputsList, { type: '', quantity: '' }])}
                      className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                    >
                      <i className="fas fa-plus"></i> Add Input Row
                    </button>
                  </div>
                  <div className="space-y-3">
                    {organicInputsList.map((row, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-100 relative">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Farm Inputs Type/Variety</label>
                          <input
                            type="text"
                            required
                            value={row.type}
                            onChange={(e) => {
                              const updated = [...organicInputsList];
                              updated[index].type = e.target.value;
                              setOrganicInputsList(updated);
                            }}
                            placeholder="e.g. Compost manure, Liquid fertilizer"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                          />
                        </div>
                        <div className="space-y-1 flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Quantity Available</label>
                            <input
                              type="text"
                              required
                              value={row.quantity}
                              onChange={(e) => {
                                const updated = [...organicInputsList];
                                updated[index].quantity = e.target.value;
                                setOrganicInputsList(updated);
                              }}
                              placeholder="e.g. 50 kg, 10 Liters"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                            />
                          </div>
                          {organicInputsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setOrganicInputsList(organicInputsList.filter((_, i) => i !== index))}
                              className="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-xl transition-all mb-0.5"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 3.0 Farm Implements */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-screwdriver-wrench text-emerald-600"></i> 3.0 Farm Implements Available
                  </h3>
                  <button
                    type="button"
                    onClick={() => setImplementsList([...implementsList, { type: '', quantity: '' }])}
                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                  >
                    <i className="fas fa-plus"></i> Add Implement Row
                  </button>
                </div>
                <div className="space-y-3">
                  {implementsList.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Implement Type</label>
                        <input
                          type="text"
                          required
                          value={row.type}
                          onChange={(e) => {
                            const updated = [...implementsList];
                            updated[index].type = e.target.value;
                            setImplementsList(updated);
                          }}
                          placeholder="e.g. Hand Hoe, Watering Can, Wheelbarrow"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Quantity Available</label>
                          <input
                            type="text"
                            required
                            value={row.quantity}
                            onChange={(e) => {
                              const updated = [...implementsList];
                              updated[index].quantity = e.target.value;
                              setImplementsList(updated);
                            }}
                            placeholder="e.g. 2 pieces"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                          />
                        </div>
                        {implementsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setImplementsList(implementsList.filter((_, i) => i !== index))}
                            className="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-xl transition-all mb-0.5"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4.0 Food Consumption */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-utensils text-emerald-600"></i> 4.0 Food Consumption (Most Consumed & Source)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setConsumptionList([...consumptionList, { type: '', source: '' }])}
                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                  >
                    <i className="fas fa-plus"></i> Add Consumption Row
                  </button>
                </div>
                <div className="space-y-3">
                  {consumptionList.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Type of Food Consumed Most</label>
                        <input
                          type="text"
                          required
                          value={row.type}
                          onChange={(e) => {
                            const updated = [...consumptionList];
                            updated[index].type = e.target.value;
                            setConsumptionList(updated);
                          }}
                          placeholder="e.g. Ugali, Sukuma Wiki, Beans"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1 flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Source of Food</label>
                          <input
                            type="text"
                            required
                            value={row.source}
                            onChange={(e) => {
                              const updated = [...consumptionList];
                              updated[index].source = e.target.value;
                              setConsumptionList(updated);
                            }}
                            placeholder="e.g. Own Farm / Food Coop / Local Market"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700"
                          />
                        </div>
                        {consumptionList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setConsumptionList(consumptionList.filter((_, i) => i !== index))}
                            className="bg-red-50 text-red-500 hover:bg-red-100 p-2.5 rounded-xl transition-all mb-0.5"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5.0 Declaration & Attestations */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                  <i className="fas fa-file-contract text-emerald-600"></i> 5.0 Declaration & Attestations
                </h3>
                <p className="text-[11px] font-bold text-slate-500 leading-relaxed italic bg-white p-4 rounded-2xl border border-slate-100">
                  "We declare that the responses given in the above sections are true and complete and that we have not withheld any material information. We also agree that the responses shall be used for purposes of Food Coop planning and engagement."
                </p>

                {/* Signature Pads */}
                <div className="space-y-6">
                  {/* Parent Pad */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Household Parent/Guardian Signature</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Type Parent/Guardian Full Name</label>
                        <input
                          type="text"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          placeholder="Type name here..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-400 text-xs transition-all"
                        />
                      </div>
                      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[100px]">
                        {parentName ? (
                          <>
                            <span 
                              className="text-4xl text-blue-900 tracking-wide select-none"
                              style={{ fontFamily: "'Great Vibes', cursive" }}
                            >
                              {parentName}
                            </span>
                            <span className="text-[8px] font-mono text-slate-400 absolute bottom-2 right-3">{parentSignedAt}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Electronic Signature Preview</span>
                        )}
                      </div>
                    </div>
                    <label className="flex items-start space-x-3 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={parentAttested}
                        onChange={(e) => setParentAttested(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 text-xs"
                      />
                      <span className="text-[11px] font-bold text-slate-500 leading-tight">
                        I, {parentName || "Parent/Guardian"}, confirm and attest that this typed electronic signature represents my official consent and validation of the household assessment data.
                      </span>
                    </label>
                  </div>

                  {/* Sales Agent Confirmation (6.0) */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">6.0 Food Coop Sales Agent Confirmation</span>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Select Sales Agent</label>
                        <select
                          value={salesAgentName}
                          onChange={(e) => setSalesAgentName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-400 text-xs transition-all appearance-none"
                        >
                          <option value="">Select Sales Agent</option>
                          {users.map((u: any) => (
                            <option key={u.phone} value={u.name || u.phone}>
                              {u.name || u.phone}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Youth Agent Confirmation (6.0) */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block">6.0 Food Coop Youth Agent Confirmation</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Type Youth Agent Full Name</label>
                        <input
                          type="text"
                          value={youthAgentName}
                          onChange={(e) => setYouthAgentName(e.target.value)}
                          placeholder="Type name here..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-400 text-xs transition-all"
                        />
                      </div>
                      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[100px]">
                        {youthAgentName ? (
                          <>
                            <span 
                              className="text-4xl text-amber-900 tracking-wide select-none"
                              style={{ fontFamily: "'Great Vibes', cursive" }}
                            >
                              {youthAgentName}
                            </span>
                            <span className="text-[8px] font-mono text-slate-400 absolute bottom-2 right-3">{youthAgentSignedAt}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Electronic Signature Preview</span>
                        )}
                      </div>
                    </div>
                    <label className="flex items-start space-x-3 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={youthAgentAttested}
                        onChange={(e) => setYouthAgentAttested(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 text-xs"
                      />
                      <span className="text-[11px] font-bold text-slate-500 leading-tight">
                        I, {youthAgentName || "Youth Agent"}, on behalf of the Food Coop, confirm and attest that we verified the correctness of the information given by this Household.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Household/Homestead Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    Household/Homestead Name
                  </label>
                  <input
                    type="text"
                    name="homesteadName"
                    list="homestead-list"
                    required
                    placeholder="Enter household or homestead name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                    onChange={(e) => {
                      const match = users.find(
                        (u) => (u.homesteadName || u.name) === e.target.value,
                      );
                      if (match) {
                        const contactInput = e.target.form?.elements.namedItem(
                          "homesteadContact",
                        ) as HTMLInputElement;
                        if (contactInput) contactInput.value = match.phone;
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    Household/Homestead Contact
                  </label>
                  <input
                    type="text"
                    name="homesteadContact"
                    required
                    placeholder="Enter contact number or email"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              {/* Crops and Livestock Kept */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                  Crops and Livestock Kept
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      Crops grown in my Household or Homestead
                    </label>
                    <textarea
                      name="cropsGrown"
                      rows={3}
                      required
                      placeholder="List crops grown..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
                    ></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      Livestock Kept in my Household or Homestead
                    </label>
                    <textarea
                      name="livestockKept"
                      rows={3}
                      required
                      placeholder="List livestock kept..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Weekly Farm Activities and Challenges Faced */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                  Weekly Farm Activities and Challenges Faced
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      List the weekly farm activities in household or homestead
                    </label>
                    <textarea
                      name="weeklyActivities"
                      rows={3}
                      required
                      placeholder="List weekly activities..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
                    ></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      List the challenges faced in conducting the farm
                      activities in household or homestead
                    </label>
                    <textarea
                      name="challengesFaced"
                      rows={3}
                      required
                      placeholder="List challenges faced..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Food Coop Marketplace */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                  Food Coop Marketplace
                </h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      List the types of Farm Food, Processed Food and None Food
                      Products to order from Food Coop this week
                    </label>
                    <textarea
                      name="foodConsumed"
                      rows={3}
                      required
                      placeholder="List products to order this week..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
                    ></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                      List products to supply Food Coop this week
                    </label>
                    <textarea
                      name="productsNeeded"
                      rows={3}
                      required
                      placeholder="List products to supply..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          )}

          {submitStatus && (
            <div
              className={`mt-4 p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-3 ${
                submitStatus.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : submitStatus.type === "loading"
                  ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              <i
                className={`fas ${
                  submitStatus.type === "success"
                    ? "fa-check-circle"
                    : submitStatus.type === "loading"
                    ? "fa-circle-notch fa-spin"
                    : "fa-exclamation-triangle"
                }`}
              ></i>
              {submitStatus.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 shadow-xl transition-all disabled:opacity-50 mt-8"
          >
            {isSubmitting ? "Submitting..." : "Submit Form"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FarmForms;
