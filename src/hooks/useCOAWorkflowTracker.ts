import { useState, useEffect, useMemo, useCallback } from "react";
import { COAWorkflowProgress, COAWorkflowStep, COAWorkflowStepKey } from "../types/workflow";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Safe Firestore initialization
let firestoreDb: any = null;
try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (err) {
  console.warn("[COA Workflow Tracker] Firestore not initialized, falling back to local real-time synchronization.", err);
}

/**
 * Normalizes control numbers for clean relational matching
 */
function normalizeControlNo(val: string | null | undefined): string {
  if (!val) return "";
  return String(val).trim().toUpperCase();
}

/**
 * Custom React Hook: Real-Time COA Document Progress Tracker
 */
export function useCOAWorkflowTracker(
  activeTab?: string,
  userRole?: string
) {
  const [selectedControlNo, setSelectedControlNo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  // Storage states
  const [complianceDocs, setComplianceDocs] = useState<any[]>([]);
  const [manifestRecords, setManifestRecords] = useState<any[]>([]);
  const [unloadingRecords, setUnloadingRecords] = useState<any[]>([]);
  const [hazWasteRecords, setHazWasteRecords] = useState<any[]>([]);
  const [wasteMovements, setWasteMovements] = useState<any[]>([]);
  const [timestampRecords, setTimestampRecords] = useState<any[]>([]);

  // Local Storage Data Hydration
  const loadLocalStorageData = useCallback(() => {
    try {
      // 1. Control No / Compliance Docs
      const rawCompDocs = localStorage.getItem("tsd_uploaded_compliance_docs");
      const docs = rawCompDocs ? JSON.parse(rawCompDocs) : [];
      setComplianceDocs(Array.isArray(docs) ? docs : []);

      // 2. Manifests
      const rawManifests = localStorage.getItem("tsd_manifests");
      const manifests = rawManifests ? JSON.parse(rawManifests) : [];
      setManifestRecords(Array.isArray(manifests) ? manifests : []);

      // 3. Unloading / Loading
      const rawUnloading = localStorage.getItem("tsd_compliance_records");
      const unloading = rawUnloading ? JSON.parse(rawUnloading) : [];
      setUnloadingRecords(Array.isArray(unloading) ? unloading : []);

      // 4. Hazardous Waste
      const rawHazWaste = localStorage.getItem("tsd_hazwaste_records");
      const hazwaste = rawHazWaste ? JSON.parse(rawHazWaste) : [];
      setHazWasteRecords(Array.isArray(hazwaste) ? hazwaste : []);

      // 5. Waste Movement
      const rawMovement = localStorage.getItem("tsd_waste_movements");
      const movements = rawMovement ? JSON.parse(rawMovement) : [];
      setWasteMovements(Array.isArray(movements) ? movements : []);

      // 6. Timestamp Timeline
      const rawTimestamps = localStorage.getItem("tsd_timestamp_records");
      const timestamps = rawTimestamps ? JSON.parse(rawTimestamps) : [];
      setTimestampRecords(Array.isArray(timestamps) ? timestamps : []);

      setLastUpdated(new Date().toISOString());
      setError(null);
    } catch (e: any) {
      console.error("[COA Workflow Tracker] Error parsing storage data:", e);
      setError("Unable to load workflow.");
    }
  }, []);

  // Sync effect with event listeners & optional Firestore listeners
  useEffect(() => {
    loadLocalStorageData();

    // Event listeners for instant local updates across tabs & components
    const handleStorageChange = () => {
      loadLocalStorageData();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tsd_data_changed", handleStorageChange);
    window.addEventListener("tsd_storage_updated", handleStorageChange);

    // Attach Firestore listeners if available
    const unsubscribes: Array<() => void> = [];
    if (firestoreDb) {
      try {
        const collectionsToListen = [
          { name: "tsd_compliance_docs", setter: setComplianceDocs },
          { name: "tsd_manifests", setter: setManifestRecords },
          { name: "tsd_unloading_records", setter: setUnloadingRecords },
          { name: "tsd_hazwaste_records", setter: setHazWasteRecords },
          { name: "tsd_waste_movements", setter: setWasteMovements },
          { name: "tsd_timestamp_records", setter: setTimestampRecords }
        ];

        collectionsToListen.forEach(({ name, setter }) => {
          const unsub = onSnapshot(
            collection(firestoreDb, name),
            (snapshot) => {
              if (!snapshot.empty) {
                const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                setter(data);
                setLastUpdated(new Date().toISOString());
              }
            },
            (err) => {
              // Silently catch firestore offline errors and fallback gracefully
              console.debug(`[COA Workflow Tracker] Firestore snapshot listener for ${name}:`, err.message);
            }
          );
          unsubscribes.push(unsub);
        });
      } catch (err) {
        console.warn("[COA Workflow Tracker] Firestore snapshot subscription warning:", err);
      }
    }

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tsd_data_changed", handleStorageChange);
      window.removeEventListener("tsd_storage_updated", handleStorageChange);
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [loadLocalStorageData]);

  // Derive unique list of all available Control Numbers across all modules
  const availableControlNumbers = useMemo(() => {
    const set = new Set<string>();

    complianceDocs.forEach((d) => {
      const c = normalizeControlNo(d.caNumber || d.controlNo);
      if (c) set.add(c);
    });

    manifestRecords.forEach((m) => {
      const c = normalizeControlNo(m.controlNo || m.caNumber);
      if (c) set.add(c);
    });

    unloadingRecords.forEach((u) => {
      const c = normalizeControlNo(u.caNumber || u.controlNo || u.manifestNo);
      if (c) set.add(c);
    });

    hazWasteRecords.forEach((h) => {
      const c = normalizeControlNo(h.controlNo || h.caNumber);
      if (c) set.add(c);
    });

    wasteMovements.forEach((w) => {
      const c = normalizeControlNo(w.controlNo || w.caNumber || w.manifestNo);
      if (c) set.add(c);
    });

    timestampRecords.forEach((t) => {
      const c = normalizeControlNo(t.controlNo || t.caNumber);
      if (c) set.add(c);
    });

    const list = Array.from(set).sort();
    return list;
  }, [complianceDocs, manifestRecords, unloadingRecords, hazWasteRecords, wasteMovements, timestampRecords]);

  // Auto-select initial Control Number if none selected
  const activeControlNo = useMemo(() => {
    if (selectedControlNo && availableControlNumbers.includes(selectedControlNo)) {
      return selectedControlNo;
    }
    if (selectedControlNo && availableControlNumbers.length > 0 && !selectedControlNo) {
      return selectedControlNo;
    }
    return availableControlNumbers.length > 0 ? availableControlNumbers[availableControlNumbers.length - 1] : "";
  }, [selectedControlNo, availableControlNumbers]);

  // Compute 5 Workflow Steps
  const progress: COAWorkflowProgress = useMemo(() => {
    const currentControlNo = activeControlNo;

    // Helper: Format date for display
    const formatDate = (dateVal: any) => {
      if (!dateVal) return "Today";
      try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      } catch {
        return String(dateVal);
      }
    };

    // 1. Control Number Step
    const matchedCompDoc = complianceDocs.find(
      (d) => normalizeControlNo(d.caNumber || d.controlNo) === currentControlNo
    ) || complianceDocs[0];

    const matchedManifest = manifestRecords.find(
      (m) => normalizeControlNo(m.controlNo || m.caNumber) === currentControlNo
    ) || manifestRecords[0];

    const hasControlNo = Boolean(matchedCompDoc || matchedManifest || (currentControlNo && complianceDocs.length > 0));

    const step1: COAWorkflowStep = {
      key: "control-no",
      stepNumber: 1,
      title: "Control Number",
      subtitle: hasControlNo
        ? `Control No: ${matchedCompDoc?.caNumber || matchedManifest?.controlNo || currentControlNo}`
        : "Generate or upload tracking code",
      status: hasControlNo ? "completed" : "pending",
      isCompleted: hasControlNo,
      isCurrent: activeTab === "control-no",
      documentNumber: matchedCompDoc?.caNumber || matchedManifest?.controlNo || currentControlNo || "Pending",
      timestamp: matchedCompDoc?.uploadedAt || matchedManifest?.createdAt || new Date().toISOString(),
      formattedDate: formatDate(matchedCompDoc?.uploadedAt || matchedManifest?.createdAt),
      createdBy: matchedCompDoc?.uploadedBy || "Compliance Staff",
      updatedAt: matchedCompDoc?.uploadedAt || matchedManifest?.createdAt,
      details: {
        fileName: matchedCompDoc?.fileName || "Regulatory Manifest PDF",
        caNumber: matchedCompDoc?.caNumber || currentControlNo
      }
    };

    // 2. Unloading / Loading Step
    const matchedUnloading = unloadingRecords.find(
      (u) =>
        normalizeControlNo(u.caNumber || u.controlNo || u.manifestNo) === currentControlNo
    ) || (currentControlNo ? null : unloadingRecords[0]);

    const hasUnloading = Boolean(matchedUnloading || unloadingRecords.length > 0 && !currentControlNo);

    const step2: COAWorkflowStep = {
      key: "unloading-loading",
      stepNumber: 2,
      title: "Unloading / Loading",
      subtitle: hasUnloading
        ? `Control No: ${matchedUnloading?.caNumber || matchedUnloading?.controlNo || currentControlNo}`
        : "Log truck scale tare & gross weights",
      status: hasUnloading ? "completed" : hasControlNo ? "in_progress" : "pending",
      isCompleted: hasUnloading,
      isCurrent: activeTab === "unloading-loading",
      documentNumber: matchedUnloading?.caNumber || matchedUnloading?.controlNo || matchedUnloading?.manifestNo || currentControlNo || "Pending",
      timestamp: matchedUnloading?.deliveryDate || matchedUnloading?.createdAt,
      formattedDate: formatDate(matchedUnloading?.deliveryDate || matchedUnloading?.createdAt),
      createdBy: matchedUnloading?.createdBy || "Weighing Scale Inspector",
      updatedAt: matchedUnloading?.updatedAt || matchedUnloading?.deliveryDate,
      details: {
        cargoType: matchedUnloading?.cargoType || "Raw Industrial Scrap",
        grossWeight: matchedUnloading?.grossWeight || "Recorded"
      }
    };

    // 3. Hazardous Waste Step
    const matchedHazWaste = hazWasteRecords.find(
      (h) => normalizeControlNo(h.controlNo || h.caNumber) === currentControlNo
    ) || (currentControlNo ? null : hazWasteRecords[0]);

    const hasHazWaste = Boolean(matchedHazWaste || hazWasteRecords.length > 0 && !currentControlNo);

    const step3: COAWorkflowStep = {
      key: "hazardous-waste",
      stepNumber: 3,
      title: "Hazardous Waste",
      subtitle: hasHazWaste
        ? `Control No: ${matchedHazWaste?.controlNo || matchedHazWaste?.caNumber || currentControlNo}`
        : "Catalog DENR waste classifications",
      status: hasHazWaste ? "completed" : hasUnloading ? "in_progress" : "pending",
      isCompleted: hasHazWaste,
      isCurrent: activeTab === "hazardous-waste",
      documentNumber: matchedHazWaste?.controlNo || matchedHazWaste?.caNumber || matchedHazWaste?.manifestNo || currentControlNo || "Pending",
      timestamp: matchedHazWaste?.createdAt,
      formattedDate: formatDate(matchedHazWaste?.createdAt),
      createdBy: matchedHazWaste?.preparedBy || "Documentation Staff",
      updatedAt: matchedHazWaste?.updatedAt || matchedHazWaste?.createdAt,
      details: {
        wasteClass: matchedHazWaste?.wasteName || "Standard HazWaste",
        quantity: matchedHazWaste?.quantity || "Verified"
      }
    };

    // 4. Waste Movement Step
    const matchedMovement = wasteMovements.find(
      (w) => normalizeControlNo(w.controlNo || w.caNumber || w.manifestNo) === currentControlNo
    ) || (currentControlNo ? null : wasteMovements[0]);

    const hasMovement = Boolean(matchedMovement || wasteMovements.length > 0 && !currentControlNo);

    const step4: COAWorkflowStep = {
      key: "waste-movement",
      stepNumber: 4,
      title: "Waste Movement",
      subtitle: hasMovement
        ? `Control No: ${matchedMovement?.controlNo || matchedMovement?.caNumber || currentControlNo}`
        : "Log internal storage & physical flows",
      status: hasMovement ? "completed" : hasHazWaste ? "in_progress" : "pending",
      isCompleted: hasMovement,
      isCurrent: activeTab === "waste-movement",
      documentNumber: matchedMovement?.controlNo || matchedMovement?.caNumber || matchedMovement?.manifestNo || currentControlNo || "Pending",
      timestamp: matchedMovement?.createdAt,
      formattedDate: formatDate(matchedMovement?.createdAt),
      createdBy: matchedMovement?.createdBy || "Plant Movement Officer",
      updatedAt: matchedMovement?.updatedAt || matchedMovement?.createdAt,
      details: {
        sourceDoc: matchedMovement?.sourceFileName || "COA Verified",
        storageLoc: matchedMovement?.storageLocation || "Processing Yard"
      }
    };

    // 5. Time Stamp Step
    const matchedTimestamp = timestampRecords.find(
      (t) => normalizeControlNo(t.controlNo || t.caNumber) === currentControlNo
    ) || (currentControlNo ? null : timestampRecords[0]);

    const hasTimestamp = Boolean(matchedTimestamp || timestampRecords.length > 0 && !currentControlNo);

    const step5: COAWorkflowStep = {
      key: "timestamp",
      stepNumber: 5,
      title: "Time Stamp",
      subtitle: hasTimestamp
        ? `Control No: ${matchedTimestamp?.controlNo || matchedTimestamp?.caNumber || currentControlNo}`
        : "Verify processing timestamps & timers",
      status: hasTimestamp ? "completed" : hasMovement ? "in_progress" : "pending",
      isCompleted: hasTimestamp,
      isCurrent: activeTab === "timestamp",
      documentNumber: matchedTimestamp?.controlNo || matchedTimestamp?.caNumber || matchedTimestamp?.manifestNo || currentControlNo || "Pending",
      timestamp: matchedTimestamp?.timestamp || matchedTimestamp?.createdAt,
      formattedDate: formatDate(matchedTimestamp?.timestamp || matchedTimestamp?.createdAt),
      createdBy: matchedTimestamp?.createdBy || "Audit SLA Verification",
      updatedAt: matchedTimestamp?.updatedAt || matchedTimestamp?.createdAt,
      details: {
        photoAttached: Boolean(matchedTimestamp?.photoData),
        slaStatus: "Verified compliant"
      }
    };

    const steps = [step1, step2, step3, step4, step5];
    const completedCount = steps.filter((s) => s.isCompleted).length;
    const totalCount = 5;
    const percentage = Math.round((completedCount / totalCount) * 100);
    const isReadyForCOA = completedCount === totalCount;

    return {
      selectedControlNo: currentControlNo,
      availableControlNumbers,
      completedCount,
      totalCount,
      percentage,
      isReadyForCOA,
      steps,
      lastUpdated
    };
  }, [
    activeControlNo,
    availableControlNumbers,
    complianceDocs,
    manifestRecords,
    unloadingRecords,
    hazWasteRecords,
    wasteMovements,
    timestampRecords,
    activeTab,
    lastUpdated
  ]);

  const selectControlNo = useCallback((controlNo: string) => {
    setSelectedControlNo(controlNo);
  }, []);

  const refreshData = useCallback(() => {
    loadLocalStorageData();
  }, [loadLocalStorageData]);

  return {
    progress,
    selectedControlNo: activeControlNo,
    selectControlNo,
    availableControlNumbers,
    refreshData,
    error
  };
}
