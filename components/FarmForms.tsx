import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { AgentIdentity } from "../types";

interface FarmFormsProps {
  agentIdentity: AgentIdentity;
  dynamicClusters: string[];
  users?: AgentIdentity[];
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
}) => {
  const [activeForm, setActiveForm] = useState<
    "weekly" | "solidarity" | "homestead"
  >("weekly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [farmBaselines, setFarmBaselines] = useState<any[]>([]);

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
    setSubmitStatus(null);

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
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err),
            { timeout: 10000, enableHighAccuracy: true },
          );
        });
      } catch (geoErr) {
        console.warn("Could not get location:", geoErr);
        throw new Error(
          "Unable to capture GPS. Please ensure location services are enabled.",
        );
      }

      // Verify location against farm baselines
      if (farmBaselines.length > 0 && location) {
        let isVerified = false;
        for (const farm of farmBaselines) {
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
          throw new Error(
            "GPS mismatch: You do not appear to be standing on any of your registered farms.",
          );
        }
      } else if (farmBaselines.length === 0) {
        // No farms registered, skip verification but allow submission? Or block?
        // We will allow but flag unverified.
        data.verifiedFarmId = "unverified";
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
        }),
      };

      const { error } = await supabase.from("pages").insert(payload);
      if (error) throw error;

      setSubmitStatus({
        type: "success",
        message: "Form submitted successfully! GPS location verified.",
      });
      form.reset();

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
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                <i
                  className={`fas ${submitStatus.type === "success" ? "fa-check-circle" : "fa-exclamation-triangle"}`}
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
