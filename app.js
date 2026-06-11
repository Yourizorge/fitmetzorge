const STORE_KEY = "fmz-coach-app-v1";
const REMEMBER_KEY = "fmz-remember-login";
const REMEMBER_DETAILS_KEY = "fmz-remembered-account";
const FMZ_CONFIG = window.FMZ_CONFIG || {};
const SUPABASE_URL = String(FMZ_CONFIG.SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(FMZ_CONFIG.SUPABASE_ANON_KEY || "").trim();
const INVITE_FUNCTION_NAME = FMZ_CONFIG.INVITE_FUNCTION_NAME || "invite-client";
const HAS_ONLINE_CONFIG = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase?.createClient);

const authStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      const remember = localStorage.getItem(REMEMBER_KEY) !== "false";
      const target = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      target.setItem(key, value);
      other.removeItem(key);
    } catch {
      // If storage is blocked, Supabase simply cannot persist the session.
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // Ignore cleanup failures.
    }
  }
};

const supabaseClient = HAS_ONLINE_CONFIG
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: authStorage
      }
    })
  : null;

let onlineProfile = null;
let onlineReady = false;
let hydratingFromCloud = false;
let cloudSaveTimer = null;

window.addEventListener("error", (event) => {
  showRuntimeError(event.message || "Onbekende fout");
});

window.addEventListener("unhandledrejection", (event) => {
  showRuntimeError(event.reason?.message || String(event.reason || "Onbekende fout"));
});

function showRuntimeError(message) {
  const existing = document.querySelector(".runtime-error");
  if (existing) {
    existing.textContent = `App fout: ${message}`;
    return;
  }
  const box = document.createElement("div");
  box.className = "runtime-error";
  box.textContent = `App fout: ${message}`;
  document.body.prepend(box);
}

const DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

const PRODUCTS = [
  { id: "havermout", name: "Havermout", kcal: 379, protein: 13.2, carbs: 67.7, fat: 6.5 },
  { id: "kipfilet", name: "Kipfilet", kcal: 110, protein: 23, carbs: 0, fat: 1.5 },
  { id: "rijst", name: "Rijst gekookt", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: "aardappel", name: "Aardappel gekookt", kcal: 87, protein: 1.9, carbs: 20.1, fat: 0.1 },
  { id: "zoete-aardappel", name: "Zoete aardappel", kcal: 86, protein: 1.6, carbs: 20.1, fat: 0.1 },
  { id: "volkoren-wrap", name: "Volkoren wrap", kcal: 310, protein: 9, carbs: 50, fat: 7 },
  { id: "broccoli", name: "Broccoli", kcal: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
  { id: "groentenmix", name: "Groentenmix", kcal: 42, protein: 2, carbs: 6, fat: 0.5 },
  { id: "zalm", name: "Zalm", kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "mager-gehakt", name: "Mager gehakt", kcal: 170, protein: 22, carbs: 3, fat: 8 },
  { id: "skyr", name: "Skyr", kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
  { id: "kwark", name: "Magere kwark", kcal: 60, protein: 10, carbs: 4, fat: 0.2 },
  { id: "griekse-yoghurt", name: "Griekse yoghurt 0%", kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { id: "huttenkase", name: "Huttenkase", kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { id: "whey", name: "Whey protein", kcal: 390, protein: 80, carbs: 7, fat: 6 },
  { id: "ei", name: "Ei", kcal: 143, protein: 13, carbs: 1.1, fat: 9.5 },
  { id: "amandelen", name: "Amandelen", kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { id: "banaan", name: "Banaan", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { id: "blauwe-bessen", name: "Blauwe bessen", kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3 },
  { id: "appel", name: "Appel", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { id: "volkoren-brood", name: "Volkoren brood", kcal: 247, protein: 9, carbs: 41, fat: 4.2 },
  { id: "volkoren-pasta", name: "Volkoren pasta gekookt", kcal: 124, protein: 5.3, carbs: 26, fat: 0.5 },
  { id: "quinoa", name: "Quinoa gekookt", kcal: 120, protein: 4.4, carbs: 21.3, fat: 1.9 },
  { id: "couscous", name: "Couscous gekookt", kcal: 112, protein: 3.8, carbs: 23.2, fat: 0.2 },
  { id: "bulgur", name: "Bulgur gekookt", kcal: 83, protein: 3.1, carbs: 18.6, fat: 0.2 },
  { id: "tonijn", name: "Tonijn in water", kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { id: "kalkoenfilet", name: "Kalkoenfilet", kcal: 104, protein: 23, carbs: 0, fat: 1 },
  { id: "garnalen", name: "Garnalen", kcal: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  { id: "rundertartaar", name: "Rundertartaar", kcal: 160, protein: 21, carbs: 0, fat: 8 },
  { id: "tofu", name: "Tofu", kcal: 144, protein: 15.7, carbs: 3.9, fat: 8.7 },
  { id: "linzen", name: "Linzen gekookt", kcal: 116, protein: 9, carbs: 20, fat: 0.4 },
  { id: "kikkererwten", name: "Kikkererwten gekookt", kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6 },
  { id: "pindakaas", name: "Pindakaas", kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { id: "avocado", name: "Avocado", kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  { id: "hummus", name: "Hummus", kcal: 166, protein: 7.9, carbs: 14.3, fat: 9.6 },
  { id: "rijstwafel", name: "Rijstwafel", kcal: 387, protein: 8, carbs: 82, fat: 3 },
  { id: "muesli", name: "Muesli", kcal: 360, protein: 10, carbs: 62, fat: 7 },
  { id: "honing", name: "Honing", kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  { id: "courgette-paprika", name: "Courgette paprika mix", kcal: 28, protein: 1.2, carbs: 5, fat: 0.3 },
  { id: "tomaat-komkommer", name: "Tomaat komkommer mix", kcal: 20, protein: 0.9, carbs: 3.5, fat: 0.2 },
  { id: "olijfolie", name: "Olijfolie", kcal: 884, protein: 0, carbs: 0, fat: 100 }
];

const MEAL_LABELS = {
  breakfast: "Ontbijt",
  lunch: "Middag",
  dinner: "Avond",
  snack: "Tussendoortje"
};

const RECIPE_TEMPLATES = {
  breakfast: [
    { name: "Skyr havermout bowl", style: "balanced", protein: "skyr", carb: "havermout", fat: "amandelen", volume: "blauwe-bessen", volumeGrams: 120 },
    { name: "Kwark banaan whey bowl", style: "high-carb", protein: "kwark", carb: "banaan", fat: "pindakaas", volume: "havermout", volumeGrams: 45 },
    { name: "Ei avocado ontbijt", style: "low-carb", protein: "ei", carb: "volkoren-brood", fat: "avocado", volume: "tomaat-komkommer", volumeGrams: 150 },
    { name: "Griekse yoghurt fruit bowl", style: "vegetarian", protein: "griekse-yoghurt", carb: "blauwe-bessen", fat: "amandelen", volume: "appel", volumeGrams: 120 },
    { name: "Huttenkase toast", style: "balanced", protein: "huttenkase", carb: "volkoren-brood", fat: "avocado", volume: "tomaat-komkommer", volumeGrams: 120 }
  ],
  lunch: [
    { name: "Kip rijst lunch bowl", style: "balanced", protein: "kipfilet", carb: "rijst", fat: "olijfolie", volume: "groentenmix", volumeGrams: 180 },
    { name: "Tonijn volkoren brood", style: "high-carb", protein: "tonijn", carb: "volkoren-brood", fat: "avocado", volume: "tomaat-komkommer", volumeGrams: 150 },
    { name: "Zalm broccoli lunch", style: "low-carb", protein: "zalm", carb: "broccoli", fat: "olijfolie", volume: "tomaat-komkommer", volumeGrams: 150 },
    { name: "Tofu wrap lunch", style: "vegetarian", protein: "tofu", carb: "volkoren-wrap", fat: "avocado", volume: "groentenmix", volumeGrams: 160 },
    { name: "Mager gehakt aardappel bowl", style: "balanced", protein: "mager-gehakt", carb: "aardappel", fat: "olijfolie", volume: "broccoli", volumeGrams: 170 }
  ],
  dinner: [
    { name: "Kip zoete aardappel bord", style: "balanced", protein: "kipfilet", carb: "zoete-aardappel", fat: "olijfolie", volume: "broccoli", volumeGrams: 200 },
    { name: "Pasta mager gehakt", style: "high-carb", protein: "mager-gehakt", carb: "volkoren-pasta", fat: "olijfolie", volume: "groentenmix", volumeGrams: 180 },
    { name: "Zalm groente bord", style: "low-carb", protein: "zalm", carb: "broccoli", fat: "avocado", volume: "tomaat-komkommer", volumeGrams: 160 },
    { name: "Tofu rijst wok", style: "vegetarian", protein: "tofu", carb: "rijst", fat: "olijfolie", volume: "groentenmix", volumeGrams: 200 },
    { name: "Tonijn pasta avond", style: "balanced", protein: "tonijn", carb: "volkoren-pasta", fat: "olijfolie", volume: "tomaat-komkommer", volumeGrams: 150 }
  ],
  snack: [
    { name: "Kwark fruit snack", style: "balanced", protein: "kwark", carb: "blauwe-bessen", fat: "amandelen", volume: "appel", volumeGrams: 100 },
    { name: "Whey banaan snack", style: "high-carb", protein: "whey", carb: "banaan", fat: "pindakaas", volume: "havermout", volumeGrams: 30 },
    { name: "Ei avocado snack", style: "low-carb", protein: "ei", carb: "tomaat-komkommer", fat: "avocado", volume: "huttenkase", volumeGrams: 80 },
    { name: "Skyr pindakaas bowl", style: "vegetarian", protein: "skyr", carb: "appel", fat: "pindakaas", volume: "blauwe-bessen", volumeGrams: 80 },
    { name: "Huttenkase bessen snack", style: "balanced", protein: "huttenkase", carb: "blauwe-bessen", fat: "amandelen", volume: "appel", volumeGrams: 90 }
  ]
};

RECIPE_TEMPLATES.breakfast.push(
  { name: "Protein muesli yoghurt", style: "balanced", protein: "griekse-yoghurt", carb: "muesli", fat: "amandelen", volume: "blauwe-bessen", volumeGrams: 120 },
  { name: "Whey havermout appel", style: "high-carb", protein: "whey", carb: "havermout", fat: "pindakaas", volume: "appel", volumeGrams: 140 },
  { name: "Hartige ei wrap", style: "balanced", protein: "ei", carb: "volkoren-wrap", fat: "avocado", volume: "tomaat-komkommer", volumeGrams: 140 },
  { name: "Skyr banaan honing", style: "high-carb", protein: "skyr", carb: "banaan", fat: "amandelen", volume: "honing", volumeGrams: 12 },
  { name: "Low-carb cottage ontbijt", style: "low-carb", protein: "huttenkase", carb: "blauwe-bessen", fat: "avocado", volume: "ei", volumeGrams: 80 },
  { name: "Vega tofu scramble toast", style: "vegetarian", protein: "tofu", carb: "volkoren-brood", fat: "olijfolie", volume: "courgette-paprika", volumeGrams: 150 }
);

RECIPE_TEMPLATES.lunch.push(
  { name: "Kalkoen avocado sandwich", style: "balanced", protein: "kalkoenfilet", carb: "volkoren-brood", fat: "avocado", volume: "tomaat-komkommer", volumeGrams: 160 },
  { name: "Garnalen couscous salade", style: "high-carb", protein: "garnalen", carb: "couscous", fat: "olijfolie", volume: "courgette-paprika", volumeGrams: 180 },
  { name: "Rundertartaar bulgur bowl", style: "balanced", protein: "rundertartaar", carb: "bulgur", fat: "olijfolie", volume: "groentenmix", volumeGrams: 180 },
  { name: "Linzen hummus wrap", style: "vegetarian", protein: "linzen", carb: "volkoren-wrap", fat: "hummus", volume: "tomaat-komkommer", volumeGrams: 150 },
  { name: "Tonijn quinoa bowl", style: "balanced", protein: "tonijn", carb: "quinoa", fat: "avocado", volume: "broccoli", volumeGrams: 170 },
  { name: "Kip low-carb salade", style: "low-carb", protein: "kipfilet", carb: "tomaat-komkommer", fat: "avocado", volume: "groentenmix", volumeGrams: 220 }
);

RECIPE_TEMPLATES.dinner.push(
  { name: "Kalkoen rijst groente", style: "balanced", protein: "kalkoenfilet", carb: "rijst", fat: "olijfolie", volume: "groentenmix", volumeGrams: 220 },
  { name: "Garnalen pasta bowl", style: "high-carb", protein: "garnalen", carb: "volkoren-pasta", fat: "olijfolie", volume: "courgette-paprika", volumeGrams: 190 },
  { name: "Rundertartaar aardappel bord", style: "balanced", protein: "rundertartaar", carb: "aardappel", fat: "olijfolie", volume: "broccoli", volumeGrams: 220 },
  { name: "Kikkererwten quinoa curry", style: "vegetarian", protein: "kikkererwten", carb: "quinoa", fat: "olijfolie", volume: "groentenmix", volumeGrams: 220 },
  { name: "Zalm avocado salade", style: "low-carb", protein: "zalm", carb: "tomaat-komkommer", fat: "avocado", volume: "broccoli", volumeGrams: 200 },
  { name: "Tofu bulgur groente", style: "vegetarian", protein: "tofu", carb: "bulgur", fat: "olijfolie", volume: "courgette-paprika", volumeGrams: 220 }
);

RECIPE_TEMPLATES.snack.push(
  { name: "Rijstwafel pindakaas whey", style: "balanced", protein: "whey", carb: "rijstwafel", fat: "pindakaas", volume: "banaan", volumeGrams: 80 },
  { name: "Skyr muesli snack", style: "high-carb", protein: "skyr", carb: "muesli", fat: "amandelen", volume: "blauwe-bessen", volumeGrams: 100 },
  { name: "Tonijn komkommer snack", style: "low-carb", protein: "tonijn", carb: "tomaat-komkommer", fat: "avocado", volume: "huttenkase", volumeGrams: 80 },
  { name: "Hummus groente rijstwafel", style: "vegetarian", protein: "hummus", carb: "rijstwafel", fat: "avocado", volume: "tomaat-komkommer", volumeGrams: 140 },
  { name: "Kwark honing appel", style: "high-carb", protein: "kwark", carb: "appel", fat: "amandelen", volume: "honing", volumeGrams: 10 },
  { name: "Ei huttenkase snackbox", style: "low-carb", protein: "ei", carb: "tomaat-komkommer", fat: "avocado", volume: "huttenkase", volumeGrams: 100 }
);

const DEFAULT_GOALS = {
  kcalTraining: 2600,
  kcalRest: 2300,
  protein: 160,
  carbsTraining: 300,
  carbsRest: 220,
  fat: 70,
  steps: 10000,
  sleep: 8,
  water: 3,
  wellbeing: 8,
  targetWeight: ""
};

const NAV = {
  trainer: [
    ["trainer-dashboard", "Dashboard"],
    ["clients", "Clienten"],
    ["training", "Trainingsschema"],
    ["nutrition", "Voedingsschema"],
    ["steps", "Stappen"],
    ["progress", "Voortgang"],
    ["wellbeing", "Welzijn"],
    ["sleep", "Slaap"],
    ["water", "Water"],
    ["agenda", "Agenda"]
  ],
  client: [
    ["client-home", "Mijn dashboard"],
    ["training", "Training"],
    ["nutrition", "Voeding"],
    ["steps", "Stappen"],
    ["progress", "Voortgang"],
    ["wellbeing", "Welzijn"],
    ["sleep", "Slaap"],
    ["water", "Water"],
    ["agenda", "Agenda"]
  ]
};

let state = normalizeState(loadState());
let currentView = state.ui.role === "client" ? "client-home" : "trainer-dashboard";
let recipeOptions = [];

function seedState() {
  return {
    ui: {
      loggedIn: false,
      authEmail: "",
      authName: "",
      role: "trainer",
      theme: "dark",
      selectedClientId: "c1",
      calendarWeekStart: startOfWeekISO(),
      trackingWeekStart: startOfWeekISO()
    },
    trainerAccount: null,
    trainerCalc: [],
    clients: [
      {
        id: "c1",
        name: "Edwin Olivier",
        email: "edwin@example.nl",
        password: "client123",
        registered: true,
        goal: "Droger worden en conditie verbeteren",
        startDate: "2026-06-10",
        goals: {
          kcalTraining: 3023,
          kcalRest: 2723,
          protein: 160,
          carbsTraining: 452,
          carbsRest: 377,
          fat: 64,
          steps: 12000,
          sleep: 8,
          water: 3,
          wellbeing: 8,
          targetWeight: 90
        },
        planSummary: "4 krachttrainingen per week, gecontroleerde calorie-inname, dagelijks stappen halen en herstel monitoren.",
        trainingPlan: [
          { day: "Maandag", exercise: "Squat", sets: 4, reps: "6-8", tempo: "3-1-1", rest: "120s" },
          { day: "Maandag", exercise: "Bench press", sets: 4, reps: "6-8", tempo: "2-1-1", rest: "120s" },
          { day: "Donderdag", exercise: "Deadlift", sets: 3, reps: "5", tempo: "2-1-1", rest: "150s" }
        ],
        nutritionPlan: [
          { meal: "Ontbijt", items: "Havermout 80g, whey 30g, banaan 120g", kcal: 527, protein: 36, carbs: 84, fat: 8 },
          { meal: "Lunch", items: "Kipfilet 200g, rijst 180g, groenten", kcal: 520, protein: 52, carbs: 55, fat: 5 }
        ],
        foodLog: [],
        steps: DAYS.map((day, index) => ({ day, value: index < 3 ? 10500 + index * 750 : "" })),
        dailyWeight: DAYS.map((day) => ({ day, value: "" })),
        measurements: [
          { week: "Week 1", weight: 94.2, waist: 98, chest: 108, arm: 38, leg: 61 }
        ],
        wellbeing: DAYS.map((day, index) => ({
          day,
          energy: index < 3 ? 7 + index : "",
          stress: index < 3 ? 4 : "",
          motivation: index < 3 ? 8 : "",
          mood: index < 3 ? "Goed" : ""
        })),
        sleep: DAYS.map((day, index) => ({
          day,
          hours: index < 3 ? 7.2 + index * 0.2 : "",
          quality: index < 3 ? 8 : "",
          bed: "",
          wake: ""
        })),
        water: 1.5,
        appointments: [
          { id: "a1", day: "Vrijdag", date: "2026-06-12", time: "10:30", type: "Check-in" }
        ]
      },
      {
        id: "c2",
        name: "Sara Janssen",
        email: "sara@example.nl",
        password: "client123",
        registered: true,
        goal: "Spiermassa opbouwen",
        startDate: "2026-06-10",
        goals: {
          kcalTraining: 2450,
          kcalRest: 2200,
          protein: 135,
          carbsTraining: 280,
          carbsRest: 210,
          fat: 70,
          steps: 9000,
          sleep: 8,
          water: 2.5,
          wellbeing: 8,
          targetWeight: ""
        },
        planSummary: "3 full body trainingen per week, progressief verhogen en slaap consistent houden.",
        trainingPlan: [],
        nutritionPlan: [],
        foodLog: [],
        steps: DAYS.map((day) => ({ day, value: "" })),
        dailyWeight: DAYS.map((day) => ({ day, value: "" })),
        measurements: [],
        wellbeing: DAYS.map((day) => ({ day, energy: "", stress: "", motivation: "", mood: "" })),
        sleep: DAYS.map((day) => ({ day, hours: "", quality: "", bed: "", wake: "" })),
        water: 0,
        appointments: []
      }
    ]
  };
}

function normalizeState(raw) {
  const next = raw && typeof raw === "object" ? raw : seedState();
  next.ui = { loggedIn: false, authEmail: "", authName: "", role: "trainer", theme: "dark", selectedClientId: "c1", calendarWeekStart: startOfWeekISO(), trackingWeekStart: startOfWeekISO(), ...(next.ui || {}) };
  next.ui.calendarWeekStart = startOfWeekISO(next.ui.calendarWeekStart || todayISO());
  next.ui.trackingWeekStart = startOfWeekISO(next.ui.trackingWeekStart || todayISO());
  const currentTrackingWeek = next.ui.trackingWeekStart;
  next.trainerAccount = next.trainerAccount && typeof next.trainerAccount === "object" ? {
    name: next.trainerAccount.name || "Trainer",
    email: String(next.trainerAccount.email || "").trim().toLowerCase(),
    password: String(next.trainerAccount.password || "")
  } : null;
  next.trainerCalc = Array.isArray(next.trainerCalc) ? next.trainerCalc : [];
  next.clients = Array.isArray(next.clients) ? next.clients : seedState().clients;
  next.clients.forEach((item) => {
    item.email = String(item.email || "").trim().toLowerCase();
    item.password ||= "client123";
    item.registered = item.registered ?? true;
    item.goals = { ...DEFAULT_GOALS, ...(item.goals || {}) };
    item.planSummary ||= "Plan nog invullen.";
    item.trainingPlan = Array.isArray(item.trainingPlan) ? item.trainingPlan : [];
    item.trainingPlan.forEach((exercise) => {
      exercise.day ||= "Maandag";
      exercise.actualSets ??= "";
      exercise.actualReps ??= "";
      exercise.notes ??= "";
      exercise.logsByWeek = exercise.logsByWeek && typeof exercise.logsByWeek === "object" ? exercise.logsByWeek : {};
      if (!exercise.logsByWeek[currentTrackingWeek]) {
        exercise.logsByWeek[currentTrackingWeek] = {
          actualSets: exercise.actualSets || "",
          actualReps: exercise.actualReps || "",
          notes: exercise.notes || ""
        };
      }
    });
    item.nutritionPlan = Array.isArray(item.nutritionPlan) ? item.nutritionPlan : [];
    item.nutritionPlan.forEach((meal) => {
      meal.status ||= "";
      meal.alternative ||= "";
      meal.logsByWeek = meal.logsByWeek && typeof meal.logsByWeek === "object" ? meal.logsByWeek : {};
      if (!meal.logsByWeek[currentTrackingWeek]) {
        meal.logsByWeek[currentTrackingWeek] = {
          status: meal.status || "",
          alternative: meal.alternative || ""
        };
      }
    });
    item.foodLog = Array.isArray(item.foodLog) ? item.foodLog : [];
    item.foodLog.forEach((entry) => {
      entry.date ||= todayISO();
      entry.unit ||= "g";
      entry.amount ??= entry.grams ?? "";
      entry.note ||= "";
    });
    item.steps = normalizeWeek(item.steps, "value");
    item.stepsByWeek = normalizeWeekStore(item.stepsByWeek, currentTrackingWeek, item.steps, "value");
    item.dailyWeight = normalizeWeek(item.dailyWeight, "value");
    item.wellbeing = normalizeWeek(item.wellbeing, "energy", { stress: "", motivation: "", mood: "" });
    item.wellbeingByWeek = normalizeWeekStore(item.wellbeingByWeek, currentTrackingWeek, item.wellbeing, "energy", { stress: "", motivation: "", mood: "" });
    item.sleep = normalizeWeek(item.sleep, "hours", { quality: "", bed: "", wake: "" });
    item.sleepByWeek = normalizeWeekStore(item.sleepByWeek, currentTrackingWeek, item.sleep, "hours", { quality: "", bed: "", wake: "" });
    item.measurements = Array.isArray(item.measurements) ? item.measurements : [];
    item.water = number(item.water, 0);
    item.waterByWeek = item.waterByWeek && typeof item.waterByWeek === "object" ? item.waterByWeek : {};
    item.waterByWeek[currentTrackingWeek] ??= item.water;
    Object.keys(item.waterByWeek).forEach((week) => {
      item.waterByWeek[week] = normalizeWaterWeek(item.waterByWeek[week]);
    });
    item.appointments = Array.isArray(item.appointments) ? item.appointments : [];
    item.appointments.forEach((appt) => {
      if (!appt.date && appt.day) {
        const match = weekDates(next.ui.calendarWeekStart).find((weekDay) => weekDay.day === appt.day);
        appt.date = match?.date || todayISO();
      }
      appt.day = dayNameFromDate(appt.date) || appt.day || "Maandag";
      appt.id ||= `a${Date.now()}${Math.random().toString(16).slice(2)}`;
    });
  });
  if (!next.clients.some((item) => item.id === next.ui.selectedClientId)) {
    next.ui.selectedClientId = next.clients[0]?.id || "";
  }
  if (next.ui.loggedIn && next.ui.role === "client") {
    const authClient = next.clients.find((item) => item.email === next.ui.authEmail);
    if (authClient) next.ui.selectedClientId = authClient.id;
    else {
      next.ui.loggedIn = false;
      next.ui.authEmail = "";
      next.ui.authName = "";
      next.ui.role = "trainer";
    }
  }
  if (next.ui.loggedIn && next.ui.role === "trainer" && !next.trainerAccount?.email) {
    next.ui.loggedIn = false;
    next.ui.authEmail = "";
    next.ui.authName = "";
    next.ui.role = "trainer";
  }
  return next;
}

function normalizeWeek(source, primaryKey, rest = {}) {
  const byDay = new Map((Array.isArray(source) ? source : []).map((item) => [item.day, item]));
  return DAYS.map((day) => ({ day, [primaryKey]: "", ...rest, ...(byDay.get(day) || {}) }));
}

function normalizeWeekStore(source, weekStart, fallback, primaryKey, rest = {}) {
  const store = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  if (!store[weekStart]) store[weekStart] = fallback;
  Object.keys(store).forEach((week) => {
    store[week] = normalizeWeek(store[week], primaryKey, rest);
  });
  return store;
}

function dayNameFromDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return DAYS[(date.getDay() + 6) % 7];
}

function todayISO() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfWeekISO(dateValue = todayISO()) {
  const date = new Date(`${dateValue}T12:00:00`);
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}

function addDaysISO(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
}

function formatLongDutchDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  const label = date.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function weekDates(weekStart) {
  return DAYS.map((day, index) => ({ day, date: addDaysISO(weekStart, index) }));
}

function activeWeekStart() {
  return state.ui.trackingWeekStart || startOfWeekISO();
}

function activeWeekEnd() {
  return addDaysISO(activeWeekStart(), 6);
}

function formatWeekRange(weekStart) {
  return `${formatShortDate(weekStart)} - ${formatShortDate(addDaysISO(weekStart, 6))}`;
}

function isDateInActiveWeek(dateValue) {
  if (!dateValue) return false;
  return dateValue >= activeWeekStart() && dateValue <= activeWeekEnd();
}

function weekArray(selected, storeKey, primaryKey, rest = {}) {
  selected[storeKey] = selected[storeKey] && typeof selected[storeKey] === "object" ? selected[storeKey] : {};
  selected[storeKey][activeWeekStart()] = normalizeWeek(selected[storeKey][activeWeekStart()], primaryKey, rest);
  return selected[storeKey][activeWeekStart()];
}

function normalizeWaterWeek(value) {
  if (Array.isArray(value)) return normalizeWeek(value, "value");
  const total = number(value);
  return DAYS.map((day, index) => ({ day, value: index === 0 && total ? total : "" }));
}

function weekWaterEntries(selected) {
  selected.waterByWeek = selected.waterByWeek && typeof selected.waterByWeek === "object" ? selected.waterByWeek : {};
  selected.waterByWeek[activeWeekStart()] = normalizeWaterWeek(selected.waterByWeek[activeWeekStart()] ?? "");
  return selected.waterByWeek[activeWeekStart()];
}

function weekWater(selected) {
  return weekWaterEntries(selected).reduce((sum, item) => sum + number(item.value), 0);
}

function setWaterDay(selected, index, value) {
  const entries = weekWaterEntries(selected);
  entries[Number(index)].value = value === "" ? "" : Math.max(0, number(value));
  selected.water = weekWater(selected);
}

function addWaterDay(selected, index, amount) {
  const entries = weekWaterEntries(selected);
  const nextValue = Math.max(0, number(entries[Number(index)].value) + number(amount));
  entries[Number(index)].value = Number(nextValue.toFixed(2));
  selected.water = weekWater(selected);
}

function exerciseWeekLog(exercise) {
  exercise.logsByWeek = exercise.logsByWeek && typeof exercise.logsByWeek === "object" ? exercise.logsByWeek : {};
  exercise.logsByWeek[activeWeekStart()] ||= { actualSets: "", actualReps: "", notes: "" };
  return exercise.logsByWeek[activeWeekStart()];
}

function mealWeekLog(meal) {
  meal.logsByWeek = meal.logsByWeek && typeof meal.logsByWeek === "object" ? meal.logsByWeek : {};
  meal.logsByWeek[activeWeekStart()] ||= { status: "", alternative: "" };
  return meal.logsByWeek[activeWeekStart()];
}

function productById(id) {
  return PRODUCTS.find((item) => item.id === id);
}

function amountToGrams(amount, unit) {
  const value = number(amount);
  if (unit === "l") return value * 1000;
  return value;
}

function foodEntryFromProduct(product, amount, unit, note = "") {
  const gramsForMacro = amountToGrams(amount, unit);
  return {
    name: product.name,
    amount: number(amount),
    unit,
    grams: gramsForMacro,
    kcal: gramsForMacro * product.kcal / 100,
    protein: gramsForMacro * product.protein / 100,
    carbs: gramsForMacro * product.carbs / 100,
    fat: gramsForMacro * product.fat / 100,
    note
  };
}

function roundRecipeGrams(grams, product) {
  const step = ["olijfolie", "pindakaas", "honing"].includes(product.id) ? 5 : 10;
  return Math.max(step, Math.round(number(grams) / step) * step);
}

function formatRecipeAmount(grams) {
  if (number(grams) >= 1000) return `${fmt(number(grams) / 1000, 1)} kg`;
  return `${fmt(grams)}g`;
}

function safeLocalGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The app can still run in memory if the browser blocks storage.
  }
}

function safeLocalRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function rememberLoginEnabled() {
  return safeLocalGet(REMEMBER_KEY) !== "false";
}

function setRememberPreference(remember, email = "", role = "trainer") {
  safeLocalSet(REMEMBER_KEY, remember ? "true" : "false");
  if (remember) {
    safeLocalSet(REMEMBER_DETAILS_KEY, JSON.stringify({ email, role }));
  } else {
    safeLocalRemove(REMEMBER_DETAILS_KEY);
  }
}

function localStateSnapshot() {
  const snapshot = JSON.parse(JSON.stringify(state));
  if (!rememberLoginEnabled()) {
    snapshot.ui.loggedIn = false;
    snapshot.ui.authEmail = "";
    snapshot.ui.authName = "";
    snapshot.ui.role = "trainer";
  }
  return snapshot;
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    return stored ? JSON.parse(stored) : seedState();
  } catch {
    return seedState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(localStateSnapshot()));
  } catch {
    // Safari or strict local-file settings can block localStorage. The app still works in memory.
  }
  scheduleCloudSave();
}

function $(selector) {
  return document.querySelector(selector);
}

function emptyClient() {
  return {
    id: "",
    name: "Nog geen client",
    email: "",
    password: "",
    registered: false,
    goal: "",
    startDate: todayISO(),
    goals: { ...DEFAULT_GOALS },
    planSummary: "Voeg eerst een client toe.",
    trainingPlan: [],
    nutritionPlan: [],
    foodLog: [],
    steps: DAYS.map((day) => ({ day, value: "" })),
    stepsByWeek: {},
    dailyWeight: DAYS.map((day) => ({ day, value: "" })),
    measurements: [],
    wellbeing: DAYS.map((day) => ({ day, energy: "", stress: "", motivation: "", mood: "" })),
    wellbeingByWeek: {},
    sleep: DAYS.map((day) => ({ day, hours: "", quality: "", bed: "", wake: "" })),
    sleepByWeek: {},
    water: 0,
    waterByWeek: {},
    appointments: []
  };
}

function client() {
  if (state.ui.loggedIn && state.ui.role === "client") {
    return state.clients.find((item) => item.email === state.ui.authEmail) || emptyClient();
  }
  return state.clients.find((item) => item.id === state.ui.selectedClientId) || state.clients[0] || emptyClient();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fmt(value, digits = 0) {
  if (value === "" || value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("nl-NL", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function average(values) {
  const nums = values.map(Number).filter((item) => Number.isFinite(item) && item > 0);
  if (!nums.length) return "";
  return nums.reduce((sum, item) => sum + item, 0) / nums.length;
}

function todayKcalGoal(selected) {
  const day = new Date().getDay();
  const isRest = day === 0 || day === 6;
  return isRest ? selected.goals.kcalRest : selected.goals.kcalTraining;
}

function sumFoodEntries(entries) {
  return entries.reduce(
    (totals, item) => ({
      kcal: totals.kcal + number(item.kcal),
      protein: totals.protein + number(item.protein),
      carbs: totals.carbs + number(item.carbs),
      fat: totals.fat + number(item.fat)
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function todayFoodLog(selected) {
  return selected.foodLog.filter((item) => isDateInActiveWeek(item.date || todayISO()));
}

function plannedMealEntries(selected) {
  return selected.nutritionPlan
    .map((item) => ({ item, log: mealWeekLog(item) }))
    .filter(({ log }) => log.status === "Gegeten zoals plan")
    .map(({ item }) => ({
      name: item.meal,
      amount: 1,
      unit: "plan",
      grams: "",
      kcal: number(item.kcal),
      protein: number(item.protein),
      carbs: number(item.carbs),
      fat: number(item.fat),
      note: "Gegeten volgens plan"
    }));
}

function dailyNutritionEntries(selected) {
  return [...plannedMealEntries(selected), ...todayFoodLog(selected)];
}

function macroTotals(selected) {
  return sumFoodEntries(dailyNutritionEntries(selected));
}

function nextAppointment(selected) {
  const nowKey = todayISO();
  return selected.appointments
    .filter((item) => item.date >= nowKey)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
}

function statusClass(value, target) {
  if (!target || value === "") return "";
  const ratio = Number(value) / Number(target);
  if (ratio >= 0.95) return "ok";
  if (ratio >= 0.75) return "warn";
  return "bad";
}

function statusText(value, target) {
  if (!target || value === "") return "-";
  const ratio = Number(value) / Number(target);
  if (ratio >= 0.95) return "Goed";
  if (ratio >= 0.75) return "Werk aan";
  return "Laag";
}

function goalPills(items) {
  return items
    .map(([label, value, unit = ""]) => `<span class="goal-pill">${label}: ${value === "" || value === undefined ? "-" : fmt(value, unit === "u" || unit === "L" || unit === "kg" ? 1 : 0)}${unit}</span>`)
    .join("");
}

function isTrainer() {
  return state.ui.loggedIn && state.ui.role === "trainer";
}

function isLoggedIn() {
  return Boolean(state.ui.loggedIn);
}

function allowedViews() {
  return NAV[state.ui.role] || [];
}

function canAccessView(id) {
  return allowedViews().some(([viewId]) => viewId === id);
}

function isOnlineMode() {
  return Boolean(supabaseClient);
}

function syncStatus(text, stateName = "") {
  const target = $("#syncStatus");
  if (!target) return;
  target.textContent = text;
  target.dataset.state = stateName;
}

function renderOnlineStatus() {
  const status = $("#onlineStatus");
  if (status) {
    status.textContent = isOnlineMode()
      ? "Online modus actief: accounts en data synchroniseren via Supabase."
      : "Demo modus: vul config.js met Supabase-gegevens om accounts tussen apparaten te synchroniseren.";
  }
  syncStatus(isOnlineMode() ? (onlineReady ? "Online opgeslagen" : "Online verbinden...") : "Lokale demo");
}

function remoteStateSnapshot() {
  const snapshot = JSON.parse(JSON.stringify(state));
  snapshot.ui = {
    ...snapshot.ui,
    loggedIn: false,
    authEmail: "",
    authName: "",
    role: "trainer"
  };
  if (snapshot.trainerAccount) {
    snapshot.trainerAccount.password = "";
  }
  snapshot.clients.forEach((item) => {
    item.password = "";
  });
  return snapshot;
}

function trainerWorkspaceId() {
  if (!onlineProfile) return "";
  return onlineProfile.role === "trainer" ? onlineProfile.id : onlineProfile.trainer_id;
}

function scheduleCloudSave() {
  if (!isOnlineMode() || !onlineReady || !onlineProfile || hydratingFromCloud) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => {
    saveStateToCloud();
  }, 650);
}

async function saveStateToCloud() {
  if (!isOnlineMode() || !onlineProfile) return;
  const trainerId = trainerWorkspaceId();
  if (!trainerId) return;
  syncStatus("Online opslaan...");
  const { error } = await supabaseClient
    .from("coach_workspaces")
    .upsert({
      trainer_id: trainerId,
      state: remoteStateSnapshot(),
      updated_at: new Date().toISOString()
    }, { onConflict: "trainer_id" });
  if (error) {
    syncStatus("Opslaan mislukt", "error");
    console.error(error);
    return;
  }
  syncStatus("Online opgeslagen", "ok");
}

function profileDisplayName(user, fallback = "") {
  return fallback || user?.user_metadata?.name || user?.email?.split("@")[0] || "Gebruiker";
}

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createOnlineTrainerState(profile) {
  const fresh = seedState();
  fresh.clients = [];
  fresh.trainerAccount = {
    name: profile.name,
    email: profile.email,
    password: ""
  };
  fresh.ui = {
    ...fresh.ui,
    loggedIn: true,
    role: "trainer",
    authEmail: profile.email,
    authName: profile.name,
    selectedClientId: "",
    theme: state.ui.theme || fresh.ui.theme
  };
  return normalizeState(fresh);
}

async function ensureOnlineProfile(roleHint = "", nameHint = "") {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) throw userError || new Error("Geen actieve gebruiker gevonden.");
  const user = userData.user;
  const email = cleanEmail(user.email);
  const { data: existing, error: existingError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    onlineProfile = existing;
    return existing;
  }

  const role = roleHint || user.user_metadata?.role || "client";
  const name = profileDisplayName(user, nameHint);
  if (role === "trainer") {
    const profile = {
      id: user.id,
      role: "trainer",
      name,
      email
    };
    const { data, error } = await supabaseClient
      .from("profiles")
      .insert(profile)
      .select("*")
      .single();
    if (error) throw error;
    onlineProfile = data;
    const trainerState = createOnlineTrainerState(data);
    await supabaseClient
      .from("coach_workspaces")
      .upsert({ trainer_id: data.id, state: trainerState, updated_at: new Date().toISOString() }, { onConflict: "trainer_id" });
    return data;
  }

  const { data, error } = await supabaseClient
    .rpc("accept_client_invite", { display_name: name })
    .single();
  if (error) throw error;
  onlineProfile = data;
  return data;
}

function applyOnlineState(remoteState, profile) {
  hydratingFromCloud = true;
  const previousTheme = state.ui.theme;
  state = normalizeState(remoteState || seedState());
  state.ui.loggedIn = true;
  state.ui.role = profile.role;
  state.ui.authEmail = profile.email;
  state.ui.authName = profile.name;
  state.ui.theme = previousTheme || state.ui.theme;
  if (profile.role === "trainer") {
    state.trainerAccount = { name: profile.name, email: profile.email, password: "" };
    currentView = "trainer-dashboard";
  } else {
    const linkedClient = state.clients.find((item) => item.id === profile.client_id) || state.clients.find((item) => item.email === profile.email);
    if (linkedClient) {
      linkedClient.registered = true;
      state.ui.selectedClientId = linkedClient.id;
    }
    currentView = "client-home";
  }
  onlineProfile = profile;
  onlineReady = true;
  renderNav();
  renderAll();
  showView(currentView);
  hydratingFromCloud = false;
}

async function loadOnlineWorkspace(profile) {
  const trainerId = profile.role === "trainer" ? profile.id : profile.trainer_id;
  if (!trainerId) throw new Error("Dit lid is nog niet gekoppeld aan een trainer.");
  syncStatus("Online laden...");
  const { data, error } = await supabaseClient
    .from("coach_workspaces")
    .select("state")
    .eq("trainer_id", trainerId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.state && profile.role !== "trainer") {
    throw new Error("Je account is nog niet gekoppeld aan een trainerworkspace.");
  }
  const remoteState = data?.state || createOnlineTrainerState(profile);
  if (!data?.state && profile.role === "trainer") {
    await supabaseClient
      .from("coach_workspaces")
      .upsert({ trainer_id: profile.id, state: remoteState, updated_at: new Date().toISOString() }, { onConflict: "trainer_id" });
  }
  applyOnlineState(remoteState, profile);
}

async function hydrateOnlineUser(roleHint = "", nameHint = "") {
  if (!isOnlineMode()) return false;
  try {
    const profile = await ensureOnlineProfile(roleHint, nameHint);
    await loadOnlineWorkspace(profile);
    return true;
  } catch (error) {
    onlineReady = false;
    syncStatus("Online fout", "error");
    throw error;
  }
}

async function inviteClientOnline(profile) {
  if (!isOnlineMode() || !onlineProfile || onlineProfile.role !== "trainer") return null;
  const { data } = await supabaseClient.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Log opnieuw in om een uitnodiging te sturen.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${INVITE_FUNCTION_NAME}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientId: profile.id,
      email: profile.email,
      name: profile.name
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Uitnodigingsmail kon niet worden verzonden.");
  }
  return payload;
}

function updateRememberControls() {
  const remember = rememberLoginEnabled();
  document.querySelectorAll('input[name="remember"]').forEach((input) => {
    input.checked = remember;
  });
  try {
    const details = JSON.parse(safeLocalGet(REMEMBER_DETAILS_KEY) || "{}");
    if (details.email) {
      $("#loginForm").elements.email.value = details.email;
      $("#loginForm").elements.role.value = details.role || "trainer";
    }
  } catch {
    // Ignore malformed remembered account data.
  }
}

function loginAs(role, email, name) {
  state.ui.loggedIn = true;
  state.ui.role = role;
  state.ui.authEmail = email;
  state.ui.authName = name;
  if (role === "client") {
    const selected = state.clients.find((item) => item.email === email);
    if (selected) state.ui.selectedClientId = selected.id;
  }
  currentView = role === "trainer" ? "trainer-dashboard" : "client-home";
  renderNav();
  renderAll();
  showView(currentView);
}

function logout() {
  state.ui.loggedIn = false;
  state.ui.authEmail = "";
  state.ui.authName = "";
  state.ui.role = "trainer";
  currentView = "trainer-dashboard";
  renderAll();
}

function renderNav() {
  const nav = $("#nav");
  const items = allowedViews();
  if (!items.some(([id]) => id === currentView)) currentView = items[0][0];
  nav.innerHTML = items
    .map(([id, label]) => `<button class="nav-btn ${id === currentView ? "active" : ""}" data-view="${id}" type="button">${label}</button>`)
    .join("");
}

function showView(id) {
  if (!isLoggedIn()) return;
  if (!canAccessView(id)) id = allowedViews()[0]?.[0] || "trainer-dashboard";
  currentView = id;
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  renderNav();
  renderAll();
}

function renderSelectors() {
  const selected = client();
  const options = state.clients.map((item) => `<option value="${item.id}" ${item.id === selected.id ? "selected" : ""}>${item.name}</option>`).join("");
  $("#clientSelect").innerHTML = options;
  $("#clientSelect").closest(".field").style.display = isTrainer() ? "grid" : "none";
  $("#appointmentClient").innerHTML = options;
  const productOptions = PRODUCTS.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  $("#productSelect").innerHTML = productOptions;
  $("#clientProductSelect").innerHTML = productOptions;
}

function renderTrainerDashboard() {
  const selected = client();
  const activeCount = state.clients.length;
  const apptCount = state.clients.reduce((sum, item) => sum + item.appointments.length, 0);
  const avgStepsAll = average(state.clients.flatMap((item) => weekArray(item, "stepsByWeek", "value").map((step) => step.value)));
  const attention = state.clients.filter((item) => {
    const stepsAvg = average(weekArray(item, "stepsByWeek", "value").map((step) => step.value));
    const sleepAvg = average(weekArray(item, "sleepByWeek", "hours", { quality: "", bed: "", wake: "" }).map((sleep) => sleep.hours));
    return (stepsAvg && stepsAvg < item.goals.steps * 0.8) || (sleepAvg && sleepAvg < item.goals.sleep * 0.8);
  }).length;

  $("#trainerKpis").innerHTML = [
    ["Clienten", activeCount, "gekoppeld"],
    ["Afspraken", apptCount, "ingepland"],
    ["Gem. stappen", fmt(avgStepsAll), "alle leden"],
    ["Aandacht", attention, "leden"]
  ]
    .map(([label, value, sub]) => `<div class="kpi"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`)
    .join("");

  const filter = $("#memberFilter").value;
  const rows = state.clients
    .filter((item) => {
      if (filter === "all") return true;
      if (filter === "today") {
        const today = todayISO();
        return item.appointments.some((appt) => appt.date === today);
      }
      const stepsAvg = average(weekArray(item, "stepsByWeek", "value").map((step) => step.value));
      const sleepAvg = average(weekArray(item, "sleepByWeek", "hours", { quality: "", bed: "", wake: "" }).map((sleep) => sleep.hours));
      return (stepsAvg && stepsAvg < item.goals.steps * 0.8) || (sleepAvg && sleepAvg < item.goals.sleep * 0.8);
    })
    .map((item) => {
      const stepsAvg = average(weekArray(item, "stepsByWeek", "value").map((step) => step.value));
      const sleepAvg = average(weekArray(item, "sleepByWeek", "hours", { quality: "", bed: "", wake: "" }).map((sleep) => sleep.hours));
      const wellbeingAvg = average(weekArray(item, "wellbeingByWeek", "energy", { stress: "", motivation: "", mood: "" }).map((entry) => (number(entry.energy) + number(entry.motivation) + (10 - number(entry.stress))) / 3));
      const appt = nextAppointment(item);
      return `
        <tr>
          <td><strong>${item.name}</strong><br><span class="muted">${item.email}</span></td>
          <td>${item.goal || "-"}</td>
          <td>${item.goals.kcalTraining}/${item.goals.kcalRest}</td>
          <td><span class="status ${statusClass(stepsAvg, item.goals.steps)}">${statusText(stepsAvg, item.goals.steps)} ${fmt(stepsAvg)}</span></td>
          <td><span class="status ${statusClass(sleepAvg, item.goals.sleep)}">${statusText(sleepAvg, item.goals.sleep)} ${fmt(sleepAvg, 1)}u</span></td>
          <td>${fmt(wellbeingAvg, 1)}</td>
          <td>${fmt(weekWater(item), 1)}L</td>
          <td>${appt ? `${appt.date} ${appt.time}` : "-"}</td>
        </tr>
      `;
    })
    .join("");
  $("#memberTable").innerHTML = rows || `<tr><td colspan="8">Geen resultaten.</td></tr>`;

  return selected;
}

function renderClientHome() {
  const selected = client();
  const totals = macroTotals(selected);
  const appt = nextAppointment(selected);
  const stepsAvg = average(weekArray(selected, "stepsByWeek", "value").map((step) => step.value));
  const sleepAvg = average(weekArray(selected, "sleepByWeek", "hours", { quality: "", bed: "", wake: "" }).map((sleep) => sleep.hours));
  const weightAvg = average(selected.dailyWeight.map((item) => item.value));

  $("#clientSummary").innerHTML = `
    <div class="panel">
      <h2>${selected.name}</h2>
      <div class="stack-list">
        <div class="metric-tile"><span>Doel</span><strong>${selected.goal || "-"}</strong></div>
        <div class="metric-tile"><span>Startdatum</span><strong>${selected.startDate}</strong></div>
        <div class="metric-tile"><span>Volgende afspraak</span><strong>${appt ? `${appt.date} ${appt.time}` : "-"}</strong></div>
      </div>
    </div>
    <div class="panel">
      <h2>Plan kort</h2>
      <p>${selected.planSummary}</p>
      <div class="kpi-grid">
        <div class="kpi"><span>Kcal vandaag</span><strong>${fmt(todayKcalGoal(selected))}</strong><small>doel</small></div>
        <div class="kpi"><span>Deze week gegeten</span><strong>${fmt(totals.kcal)}</strong><small>kcal</small></div>
        <div class="kpi"><span>Stappen</span><strong>${fmt(stepsAvg)}</strong><small>doel ${fmt(selected.goals.steps)}</small></div>
        <div class="kpi"><span>Slaap</span><strong>${fmt(sleepAvg, 1)}u</strong><small>doel ${fmt(selected.goals.sleep)}u</small></div>
        <div class="kpi"><span>Water week</span><strong>${fmt(weekWater(selected), 1)}L</strong><small>doel ${fmt(selected.goals.water * 7, 1)}L</small></div>
        <div class="kpi"><span>Gewicht week</span><strong>${fmt(weightAvg, 1)}</strong><small>gemiddelde</small></div>
      </div>
    </div>
  `;
}

function renderClients() {
  $("#clientCards").innerHTML = state.clients
    .map(
      (item) => `
        <div class="client-card ${item.id === state.ui.selectedClientId ? "active" : ""}">
          <strong>${item.name}</strong>
          <span>${item.email}</span>
          <span>${item.registered ? "Geregistreerd" : "Uitgenodigd, nog niet geregistreerd"}</span>
          <span>${item.goal || "Geen doel ingevuld"}</span>
          <div class="card-actions">
            <button class="secondary-btn" data-select-client="${item.id}" type="button">Selecteer</button>
            <button class="primary-btn" data-edit-goals="${item.id}" type="button">Doelen bewerken</button>
            <button class="danger-btn" data-delete-client="${item.id}" type="button">Client verwijderen</button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderGoalForm() {
  const selected = client();
  const form = $("#goalForm");
  if (!form) return;
  form.style.display = isTrainer() ? "block" : "none";
  $("#goalFormTitle").textContent = `Doelen bewerken: ${selected.name}`;
  $("#goalFormHint").textContent = "Kies hierboven een coachee en sla hier het plan, calorieen en trackerdoelen op.";
  form.elements.planSummary.value = selected.planSummary || "";
  form.elements.goal.value = selected.goal || "";
  Object.entries(selected.goals).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
}

function renderTraining() {
  const selected = client();
  $("#trainingForm").style.display = isTrainer() ? "grid" : "none";
  $("#trainingGoalStrip").innerHTML = goalPills([
    ["Plan", selected.goal || "-"],
    ["Stappen", selected.goals.steps],
    ["Slaap", selected.goals.sleep, "u"]
  ]);

  $("#trainingDays").innerHTML = DAYS.map((day) => {
    const exercises = selected.trainingPlan
      .map((exercise, index) => ({ ...exercise, index, source: exercise }))
      .filter((exercise) => exercise.day === day);
    return `
      <div class="training-day">
        <h3>${day}</h3>
        <div class="exercise-row">
          ${
            exercises.length
              ? exercises.map((exercise) => `
                <div class="exercise-card">
                  <strong>${exercise.exercise}</strong>
                  <div class="exercise-meta">
                    Doel: ${exercise.sets} sets x ${exercise.reps} reps
                    ${exercise.tempo ? ` | tempo ${exercise.tempo}` : ""}
                    ${exercise.rest ? ` | rust ${exercise.rest}` : ""}
                  </div>
                  <div class="exercise-log">
                    <label>Gedane sets<input data-training-log="${exercise.index}:actualSets" type="number" min="0" value="${exerciseWeekLog(exercise.source).actualSets ?? ""}" /></label>
                    <label>Gedane reps<input data-training-log="${exercise.index}:actualReps" value="${exerciseWeekLog(exercise.source).actualReps ?? ""}" placeholder="bijv. 8/8/7/6" /></label>
                    <textarea data-training-log="${exercise.index}:notes" placeholder="Opmerkingen">${exerciseWeekLog(exercise.source).notes ?? ""}</textarea>
                  </div>
                  ${isTrainer() ? `<button class="danger-btn" data-remove-training="${exercise.index}" type="button">Verwijder</button>` : ""}
                </div>
              `).join("")
              : `<div class="empty-mini">Geen oefeningen.</div>`
          }
        </div>
      </div>
    `;
  }).join("");
}

function renderNutrition() {
  const selected = client();
  $("#nutritionPlanForm").style.display = isTrainer() ? "block" : "none";
  $("#recipePanel").style.display = isTrainer() ? "block" : "none";
  $("#macroCalculatorPanel").style.display = isTrainer() ? "block" : "none";
  const foodDate = $("#foodEntryDate");
  if (foodDate) {
    foodDate.min = activeWeekStart();
    foodDate.max = activeWeekEnd();
    if (!foodDate.value || !isDateInActiveWeek(foodDate.value)) {
      foodDate.value = isDateInActiveWeek(todayISO()) ? todayISO() : activeWeekStart();
    }
  }
  const totals = macroTotals(selected);
  const goal = todayKcalGoal(selected) * 7;
  const trainerTotals = sumFoodEntries(state.trainerCalc);

  $("#dailyFoodTotals").innerHTML = [
    ["Kcal week", fmt(totals.kcal), fmt(goal)],
    ["Eiwit week", fmt(totals.protein), fmt(selected.goals.protein * 7)],
    ["KH week", fmt(totals.carbs), fmt(selected.goals.carbsTraining * 7)],
    ["Vet week", fmt(totals.fat), fmt(selected.goals.fat * 7)]
  ]
    .map(([label, value, target]) => `<div><span>${label}</span><strong>${value}</strong><span>doel ${target}</span></div>`)
    .join("");

  $("#macroTotals").innerHTML = [
    ["Kcal", fmt(trainerTotals.kcal), ""],
    ["Eiwit", fmt(trainerTotals.protein), ""],
    ["KH", fmt(trainerTotals.carbs), ""],
    ["Vet", fmt(trainerTotals.fat), ""]
  ]
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong><span>trainer berekening</span></div>`)
    .join("");

  $("#foodLogTable").innerHTML =
    state.trainerCalc
      .map(
        (item, index) => `
          <tr>
            <td data-label="Product">${item.name}</td>
            <td data-label="Hoeveelheid">${fmt(item.amount ?? item.grams)}${item.unit || "g"}</td>
            <td data-label="Kcal">${fmt(item.kcal)}</td>
            <td data-label="Eiwit">${fmt(item.protein)}</td>
            <td data-label="KH">${fmt(item.carbs)}</td>
            <td data-label="Vet">${fmt(item.fat)}</td>
            <td data-label=""><button class="danger-btn" data-remove-calc="${index}" type="button">Verwijder</button></td>
          </tr>
        `
      )
      .join("") || `<tr><td colspan="7">Nog geen trainerberekening.</td></tr>`;

  $("#nutritionPlanList").innerHTML =
    selected.nutritionPlan
      .map(
        (item, index) => `
          <div class="list-item">
            <strong>${item.meal}</strong>
            <span>${item.items}</span>
            <p>${fmt(item.kcal)} kcal | ${fmt(item.protein)}g eiwit | ${fmt(item.carbs)}g kh | ${fmt(item.fat)}g vet</p>
            ${isTrainer() ? `<button class="danger-btn" data-remove-meal="${index}" type="button">Verwijder</button>` : ""}
          </div>
        `
      )
      .join("") || `<div class="empty-state">Nog geen voedingsschema.</div>`;

  $("#plannedMealChecklist").innerHTML =
    selected.nutritionPlan
      .map((item, index) => {
        const mealLog = mealWeekLog(item);
        return `
        <div class="list-item">
          <strong>${item.meal}</strong>
          <span>${item.items}</span>
          <p>Plan: ${fmt(item.kcal)} kcal | ${fmt(item.protein)}g eiwit | ${fmt(item.carbs)}g kh | ${fmt(item.fat)}g vet</p>
          <label class="field">
            <span>Uitvoering</span>
            <select data-meal-status="${index}">
              ${["", "Gegeten zoals plan", "Anders gegeten", "Niet gegeten"].map((value) => `<option value="${value}" ${value === mealLog.status ? "selected" : ""}>${value || "Nog niet ingevuld"}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Opmerking / vervanging</span>
            <textarea data-meal-alternative="${index}" rows="2" placeholder="Bij anders gegeten: wat was anders?">${mealLog.alternative || ""}</textarea>
          </label>
        </div>
      `;
      })
      .join("") || `<div class="empty-state">Geen gepland voedingsschema om af te vinken.</div>`;

  const todayEntries = todayFoodLog(selected);
  $("#actualFoodLogTable").innerHTML =
    todayEntries
      .map((item) => {
        const originalIndex = selected.foodLog.indexOf(item);
        return `
          <tr>
            <td data-label="Product">${item.name}</td>
            <td data-label="Datum">${item.date || "-"}</td>
            <td data-label="Hoeveelheid">${fmt(item.amount ?? item.grams, item.unit === "l" ? 2 : 0)}${item.unit || "g"}</td>
            <td data-label="Kcal">${fmt(item.kcal)}</td>
            <td data-label="Eiwit">${fmt(item.protein)}</td>
            <td data-label="KH">${fmt(item.carbs)}</td>
            <td data-label="Vet">${fmt(item.fat)}</td>
            <td data-label="Opmerking">${item.note || "-"}</td>
            <td data-label=""><button class="danger-btn" data-remove-food="${originalIndex}" type="button">Verwijder</button></td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="9">In deze week is nog niets gelogd.</td></tr>`;
}

function renderSteps() {
  const selected = client();
  const steps = weekArray(selected, "stepsByWeek", "value");
  $("#stepsGoalStrip").innerHTML = goalPills([["Dagdoel stappen", selected.goals.steps]]);
  $("#stepsGrid").innerHTML = steps
    .map(
      (item, index) => `
        <div class="day-cell">
          <label>
            ${item.day}
            <input data-step-index="${index}" type="number" min="0" value="${item.value}" placeholder="Stappen" />
          </label>
          <span class="status ${statusClass(item.value, selected.goals.steps)}">${statusText(item.value, selected.goals.steps)}</span>
        </div>
      `
    )
    .join("");
}

function renderProgress() {
  const selected = client();
  const avgWeight = average(selected.dailyWeight.map((item) => item.value));
  $("#progressGoalStrip").innerHTML = goalPills([["Doelgewicht", selected.goals.targetWeight, "kg"], ["Weekgemiddelde", avgWeight, "kg"]]);
  $("#dailyWeightGrid").innerHTML =
    selected.dailyWeight
      .map(
        (item, index) => `
          <div class="day-cell">
            <label>
              ${item.day}
              <input data-weight-index="${index}" type="number" step="0.1" min="0" value="${item.value}" placeholder="kg" />
            </label>
          </div>
        `
      )
      .join("") + `<div class="day-cell"><span>Gemiddelde</span><strong>${fmt(avgWeight, 1)} kg</strong></div>`;

  $("#measurementTable").innerHTML =
    selected.measurements
      .map((item, index, all) => {
        const prev = all[index - 1];
        const diff = prev ? number(item.weight) - number(prev.weight) : 0;
        return `
          <tr>
            <td>${item.week}</td>
            <td>${fmt(item.weight, 1)}</td>
            <td>${fmt(item.waist, 1)}</td>
            <td>${fmt(item.chest, 1)}</td>
            <td>${fmt(item.arm, 1)}</td>
            <td>${fmt(item.leg, 1)}</td>
            <td>${index === 0 ? "0.0" : fmt(diff, 1)}</td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="7">Nog geen metingen.</td></tr>`;
}

function renderWellbeing() {
  const selected = client();
  const wellbeing = weekArray(selected, "wellbeingByWeek", "energy", { stress: "", motivation: "", mood: "" });
  $("#wellbeingGoalStrip").innerHTML = goalPills([["Doel welzijn", selected.goals.wellbeing]]);
  $("#wellbeingGrid").innerHTML = wellbeing
    .map((item, index) => {
      const score = [item.energy, item.motivation, number(item.stress) ? 10 - number(item.stress) : ""];
      const avg = average(score);
      return `
        <div class="day-cell">
          <strong>${item.day}</strong>
          <label>Energie<input data-wellbeing="${index}:energy" type="number" min="1" max="10" value="${item.energy}" /></label>
          <label>Stress<input data-wellbeing="${index}:stress" type="number" min="1" max="10" value="${item.stress}" /></label>
          <label>Motivatie<input data-wellbeing="${index}:motivation" type="number" min="1" max="10" value="${item.motivation}" /></label>
          <label>Stemming
            <select data-wellbeing="${index}:mood">
              ${["", "Goed", "Neutraal", "Laag"].map((value) => `<option value="${value}" ${value === item.mood ? "selected" : ""}>${value || "-"}</option>`).join("")}
            </select>
          </label>
          <span class="status ${statusClass(avg, selected.goals.wellbeing)}">Gem. ${fmt(avg, 1)}</span>
        </div>
      `;
    })
    .join("");
}

function renderSleep() {
  const selected = client();
  const sleep = weekArray(selected, "sleepByWeek", "hours", { quality: "", bed: "", wake: "" });
  $("#sleepGoalStrip").innerHTML = goalPills([["Doel slaap", selected.goals.sleep, "u"]]);
  $("#sleepGrid").innerHTML = sleep
    .map((item, index) => {
      const recovery = item.hours && item.quality ? number(item.hours) / selected.goals.sleep * 0.6 + number(item.quality) / 10 * 0.4 : "";
      return `
        <div class="day-cell">
          <strong>${item.day}</strong>
          <label>Uren<input data-sleep="${index}:hours" type="number" min="0" step="0.1" value="${item.hours}" /></label>
          <label>Kwaliteit<input data-sleep="${index}:quality" type="number" min="1" max="10" value="${item.quality}" /></label>
          <label>Naar bed<input data-sleep="${index}:bed" type="time" value="${item.bed}" /></label>
          <label>Wakker<input data-sleep="${index}:wake" type="time" value="${item.wake}" /></label>
          <span class="status ${statusClass(recovery, 0.85)}">Herstel ${fmt(recovery * 100, 0)}%</span>
        </div>
      `;
    })
    .join("");
}

function renderWater() {
  const selected = client();
  const waterEntries = weekWaterEntries(selected);
  const water = weekWater(selected);
  const weekTarget = number(selected.goals.water) * 7;
  const pct = weekTarget ? Math.min(100, water / weekTarget * 100) : 0;
  $("#waterGoalStrip").innerHTML = goalPills([["Dagdoel water", selected.goals.water, "L"], ["Weekdoel water", weekTarget, "L"]]);
  $("#waterDisplay").innerHTML = `<div><strong>${fmt(water, 2)}L</strong><span>${fmt(pct)}% van ${fmt(weekTarget, 1)}L deze week</span></div>`;
  $("#waterDayGrid").innerHTML = waterEntries
    .map((item, index) => `
      <div class="water-day-card">
        <strong>${item.day}</strong>
        <label>
          Liters
          <input data-water-day-input="${index}" type="number" min="0" step="0.25" value="${item.value}" placeholder="0" />
        </label>
        <span>${fmt(number(item.value), 2)}L / ${fmt(selected.goals.water, 1)}L</span>
        <div class="water-day-actions">
          <button class="secondary-btn" data-water-day="${index}:-0.25" type="button">-250 ml</button>
          <button class="primary-btn" data-water-day="${index}:0.25" type="button">+250 ml</button>
          <button class="primary-btn" data-water-day="${index}:0.5" type="button">+500 ml</button>
          <button class="secondary-btn" data-water-day="${index}:reset" type="button">Reset</button>
        </div>
      </div>
    `)
    .join("");
}

function renderAgenda() {
  const selected = client();
  const calendar = $("#weekCalendar");
  $("#appointmentForm").style.display = isTrainer() ? "block" : "none";
  $("#calendarControls").style.display = isTrainer() ? "flex" : "none";
  $("#agendaPanelTitle").textContent = isTrainer() ? "Weekagenda" : "Mijn afspraken";

  if (!isTrainer()) {
    const appointments = selected.appointments
      .filter((item) => !item.date || item.date >= todayISO())
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    calendar.className = "client-appointments";
    calendar.innerHTML = appointments.length
      ? appointments.map((item) => `
        <div class="client-appointment-card">
          <strong>${item.type || "Afspraak"} ${formatLongDutchDate(item.date)} ${item.time || "--:--"}</strong>
        </div>
      `).join("")
      : `<div class="empty-state">Er staan nog geen afspraken ingepland.</div>`;
    return;
  }

  calendar.className = "week-calendar trainer-calendar";
  const weekStart = state.ui.calendarWeekStart;
  const days = weekDates(weekStart);
  const weekEnd = days[6].date;
  $("#calendarWeekLabel").textContent = `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;
  const dateInput = $("#appointmentForm").elements.date;
  if (!dateInput.value || dateInput.value < weekStart || dateInput.value > weekEnd) {
    dateInput.value = weekStart;
  }
  const all = state.clients.flatMap((item) => item.appointments.map((appt) => ({ ...appt, clientName: item.name, clientId: item.id })));

  calendar.innerHTML = days.map(({ day, date }) => {
    const items = all
      .filter((item) => item.date === date)
      .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
    return `
      <div class="calendar-day" data-calendar-date="${date}">
        <h3>${day}<span>${formatShortDate(date)}</span></h3>
        ${isTrainer() ? `<button class="secondary-btn calendar-add" data-set-appointment-date="${date}" type="button">Afspraak</button>` : ""}
        ${
          items.length
            ? items.map((item) => `
              <div class="appointment-card" ${isTrainer() ? `draggable="true" data-drag-appointment="${item.clientId}:${item.id}"` : ""}>
                <strong>${item.time || "--:--"} ${item.type || "Afspraak"}</strong>
                <span>${item.clientName}${item.date ? ` | ${item.date}` : ""}</span>
                <button class="secondary-btn" data-notify="${item.clientId}:${item.id}" type="button">Melding</button>
              </div>
            `).join("")
            : `<div class="empty-mini">Geen afspraken.</div>`
        }
      </div>
    `;
  }).join("");
}

function renderRoleVisibility() {
  document.body.classList.toggle("light", state.ui.theme === "light");
  document.body.classList.toggle("logged-in", isLoggedIn());
  document.body.classList.toggle("logged-out", !isLoggedIn());
  $("#currentUserLabel").textContent = isLoggedIn() ? `${state.ui.authName || state.ui.authEmail} (${state.ui.role === "trainer" ? "Trainer" : "Lid"})` : "";
  renderOnlineStatus();
}

function renderWeekLabels() {
  document.querySelectorAll("[data-week-label]").forEach((label) => {
    label.textContent = formatWeekRange(activeWeekStart());
  });
}

function renderAll() {
  saveState();
  renderRoleVisibility();
  renderWeekLabels();
  renderSelectors();
  renderTrainerDashboard();
  renderClientHome();
  renderClients();
  renderGoalForm();
  renderTraining();
  renderNutrition();
  renderSteps();
  renderProgress();
  renderWellbeing();
  renderSleep();
  renderWater();
  renderAgenda();
}

function createClientProfile({ name, email, password = "", goal = "", registered = false }) {
  return {
    id: `c${Date.now()}${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    email: String(email).trim().toLowerCase(),
    password,
    registered,
    goal: goal.trim(),
    startDate: todayISO(),
    goals: {
      kcalTraining: 2600,
      kcalRest: 2300,
      protein: 160,
      carbsTraining: 250,
      carbsRest: 180,
      fat: 70,
      steps: 10000,
      sleep: 8,
      water: 3,
      wellbeing: 8,
      targetWeight: ""
    },
    planSummary: "Plan nog invullen.",
    trainingPlan: [],
    nutritionPlan: [],
    foodLog: [],
    steps: DAYS.map((day) => ({ day, value: "" })),
    stepsByWeek: {},
    dailyWeight: DAYS.map((day) => ({ day, value: "" })),
    measurements: [],
    wellbeing: DAYS.map((day) => ({ day, energy: "", stress: "", motivation: "", mood: "" })),
    wellbeingByWeek: {},
    sleep: DAYS.map((day) => ({ day, hours: "", quality: "", bed: "", wake: "" })),
    sleepByWeek: {},
    water: 0,
    waterByWeek: {},
    appointments: []
  };
}

async function addClient(form) {
  const data = new FormData(form);
  const email = String(data.get("email")).trim().toLowerCase();
  const message = $("#clientInviteMessage");
  if (message) {
    message.className = "form-note";
    message.textContent = "";
  }
  if (state.clients.some((item) => item.email === email)) {
    alert("Er bestaat al een client met dit e-mailadres.");
    return;
  }
  const profile = createClientProfile({
    name: data.get("name").trim(),
    email,
    password: data.get("password") || "client123",
    goal: data.get("goal").trim(),
    registered: false
  });
  profile.goals.kcalTraining = number(data.get("kcalTraining"));
  profile.goals.kcalRest = number(data.get("kcalRest"));
  profile.goals.protein = number(data.get("protein"));
  profile.goals.steps = number(data.get("steps"));
  state.clients.push(profile);
  state.ui.selectedClientId = profile.id;
  form.reset();
  form.elements.password.value = "client123";
  renderAll();
  if (isOnlineMode()) {
    try {
      if (message) message.textContent = "Client gekoppeld. Uitnodigingsmail wordt verzonden...";
      await saveStateToCloud();
      await inviteClientOnline(profile);
      if (message) {
        message.className = "form-note ok";
        message.textContent = "Client gekoppeld en uitnodigingsmail verzonden.";
      }
    } catch (error) {
      if (message) {
        message.className = "form-note error";
        message.textContent = `Client is toegevoegd, maar de uitnodigingsmail lukte niet: ${error.message}`;
      }
    }
  } else if (message) {
    message.textContent = "Demo modus: online uitnodigingsmail werkt zodra Supabase is ingesteld.";
  }
}

function mealTypeLabel(mealType) {
  return MEAL_LABELS[mealType] || "Maaltijd";
}

function mergeRecipeParts(parts) {
  const merged = new Map();
  parts.forEach((part) => {
    const current = merged.get(part.product.id);
    if (current) current.grams += part.grams;
    else merged.set(part.product.id, { ...part });
  });
  return [...merged.values()];
}

function buildRecipeFromTemplate(template, target, mealType) {
  const proteinProduct = productById(template.protein) || PRODUCTS[0];
  const carbProduct = productById(template.carb) || PRODUCTS[0];
  const fatProduct = productById(template.fat) || PRODUCTS[0];
  const volumeProduct = productById(template.volume) || PRODUCTS[0];

  const proteinGrams = proteinProduct.protein ? target.protein / proteinProduct.protein * 100 : 0;
  const carbGrams = carbProduct.carbs ? target.carbs / carbProduct.carbs * 100 : 0;
  const fatGrams = fatProduct.fat ? target.fat / fatProduct.fat * 100 : 0;
  const volumeGrams = template.volumeGrams || (template.style === "low-carb" ? 180 : 120);

  let parts = mergeRecipeParts([
    { product: proteinProduct, grams: roundRecipeGrams(Math.max(40, proteinGrams), proteinProduct) },
    { product: carbProduct, grams: roundRecipeGrams(Math.max(30, carbGrams), carbProduct) },
    { product: fatProduct, grams: roundRecipeGrams(Math.max(5, fatGrams), fatProduct) },
    { product: volumeProduct, grams: roundRecipeGrams(Math.max(40, volumeGrams), volumeProduct) }
  ]);

  let rows = parts.map(({ product, grams }) => foodEntryFromProduct(product, grams, "g"));
  let totals = sumFoodEntries(rows);
  if (target.kcal > 0 && totals.kcal > 0) {
    const scale = Math.max(0.65, Math.min(1.35, target.kcal / totals.kcal));
    parts = parts.map((item) => ({ ...item, grams: roundRecipeGrams(Math.max(5, item.grams * scale), item.product) }));
    rows = parts.map(({ product, grams }) => foodEntryFromProduct(product, grams, "g"));
    totals = sumFoodEntries(rows);
  }

  return { name: template.name, mealType, style: template.style, rows, totals, target };
}

function generateRecipes(target, mealType, style) {
  const templates = RECIPE_TEMPLATES[mealType] || Object.values(RECIPE_TEMPLATES).flat();
  const preferred = style === "all" ? templates : templates.filter((item) => item.style === style);
  const fallback = templates.filter((item) => !preferred.includes(item));
  return [...preferred, ...fallback].slice(0, 6).map((template) => buildRecipeFromTemplate(template, target, mealType));
}

function recipeIngredients(recipe) {
  return recipe.rows.map((item) => `${item.name} ${formatRecipeAmount(item.grams)}`).join(", ");
}

function notifyAppointment(clientId, appointmentId) {
  const selected = state.clients.find((item) => item.id === clientId);
  const appointment = selected?.appointments.find((item) => item.id === appointmentId);
  if (!selected || !appointment) return;
  const body = `${appointment.type || "Afspraak"} op ${appointment.date} om ${appointment.time}`;
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`Afspraak voor ${selected.name}`, { body });
  } else {
    alert(`Melding: ${selected.name} - ${body}`);
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.view) showView(target.dataset.view);
  if (target.dataset.action === "open-view") showView(target.dataset.target);
  if (target.id === "themeToggle") {
    state.ui.theme = state.ui.theme === "dark" ? "light" : "dark";
    renderAll();
  }
  if (target.dataset.selectClient) {
    state.ui.selectedClientId = target.dataset.selectClient;
    renderAll();
  }
  if (target.dataset.editGoals) {
    state.ui.selectedClientId = target.dataset.editGoals;
    showView("clients");
    setTimeout(() => $("#goalForm")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
  if (target.dataset.deleteClient) {
    if (!isTrainer()) return;
    const selectedClient = state.clients.find((item) => item.id === target.dataset.deleteClient);
    if (!selectedClient) return;
    if (!confirm(`Client ${selectedClient.name} verwijderen?`)) return;
    state.clients = state.clients.filter((item) => item.id !== selectedClient.id);
    if (state.ui.selectedClientId === selectedClient.id) state.ui.selectedClientId = state.clients[0]?.id || "";
    renderAll();
  }
  if (target.dataset.removeTraining) {
    client().trainingPlan.splice(Number(target.dataset.removeTraining), 1);
    renderAll();
  }
  if (target.dataset.removeFood) {
    client().foodLog.splice(Number(target.dataset.removeFood), 1);
    renderAll();
  }
  if (target.dataset.removeCalc) {
    state.trainerCalc.splice(Number(target.dataset.removeCalc), 1);
    renderAll();
  }
  if (target.dataset.removeMeal) {
    client().nutritionPlan.splice(Number(target.dataset.removeMeal), 1);
    renderAll();
  }
  if (target.dataset.addRecipeOption) {
    const recipe = recipeOptions[Number(target.dataset.addRecipeOption)];
    if (!recipe) return;
    client().nutritionPlan.push({
      meal: `${mealTypeLabel(recipe.mealType)} - ${recipe.name}`,
      items: recipeIngredients(recipe),
      kcal: Math.round(recipe.totals.kcal),
      protein: Math.round(recipe.totals.protein),
      carbs: Math.round(recipe.totals.carbs),
      fat: Math.round(recipe.totals.fat),
      status: "",
      alternative: ""
    });
    saveState();
    target.textContent = "Toegevoegd";
    target.disabled = true;
    renderNutrition();
  }
  if (target.dataset.waterDay) {
    const selected = client();
    const [index, amount] = target.dataset.waterDay.split(":");
    if (amount === "reset") setWaterDay(selected, index, "");
    else addWaterDay(selected, index, amount);
    renderAll();
  }
  if (target.dataset.trackingWeek) {
    if (target.dataset.trackingWeek === "today") {
      state.ui.trackingWeekStart = startOfWeekISO();
    } else {
      state.ui.trackingWeekStart = addDaysISO(activeWeekStart(), Number(target.dataset.trackingWeek) * 7);
    }
    renderAll();
  }
  if (target.dataset.notify) {
    const [clientId, appointmentId] = target.dataset.notify.split(":");
    notifyAppointment(clientId, appointmentId);
  }
  if (target.id === "prevWeek") {
    state.ui.calendarWeekStart = addDaysISO(state.ui.calendarWeekStart, -7);
    renderAll();
  }
  if (target.id === "todayWeek") {
    state.ui.calendarWeekStart = startOfWeekISO();
    renderAll();
  }
  if (target.id === "nextWeek") {
    state.ui.calendarWeekStart = addDaysISO(state.ui.calendarWeekStart, 7);
    renderAll();
  }
  if (target.dataset.setAppointmentDate) {
    $("#appointmentForm").elements.date.value = target.dataset.setAppointmentDate;
  }
});

$("#clientSelect").addEventListener("change", (event) => {
  if (!isTrainer()) return;
  state.ui.selectedClientId = event.target.value;
  renderAll();
});

$("#memberFilter").addEventListener("change", renderTrainerDashboard);

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-auth-mode]");
  if (!tab) return;
  const mode = tab.dataset.authMode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.authPanel === mode);
  });
  $("#loginMessage").textContent = "";
  $("#registerMessage").textContent = "";
});

$("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const role = data.get("role");
  const name = String(data.get("name")).trim();
  const email = String(data.get("email")).trim().toLowerCase();
  const password = String(data.get("password"));
  const remember = form.elements.remember?.checked ?? true;
  const message = $("#registerMessage");
  message.className = "login-message";

  if (password.length < 4) {
    message.textContent = "Gebruik minimaal 4 tekens voor je wachtwoord.";
    return;
  }

  setRememberPreference(remember, email, role);
  if (isOnlineMode()) {
    try {
      message.textContent = "Account wordt aangemaakt...";
      const { data: authData, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { role, name },
          emailRedirectTo: window.location.href.split("#")[0]
        }
      });
      if (error) throw error;
      if (!authData.session) {
        message.className = "login-message ok";
        message.textContent = "Account aangemaakt. Controleer je e-mail om je account te bevestigen en log daarna in.";
        form.reset();
        updateRememberControls();
        return;
      }
      await hydrateOnlineUser(role, name);
      message.textContent = "";
      form.reset();
      updateRememberControls();
      return;
    } catch (error) {
      message.className = "login-message error";
      message.textContent = role === "client" && /uitnodiging|invite/i.test(error.message)
        ? "Geen gekoppelde uitnodiging gevonden. Vraag je trainer om je via e-mail toe te voegen."
        : error.message;
      return;
    }
  }

  if (role === "trainer") {
    if (state.trainerAccount?.email) {
      message.textContent = "Er bestaat al een traineraccount. Log daarmee in.";
      return;
    }
    state.trainerAccount = { name, email, password };
    message.textContent = "";
    loginAs("trainer", email, name);
    form.reset();
    return;
  }

  const existingClient = state.clients.find((item) => item.email === email);
  if (existingClient) {
    if (existingClient.registered) {
      message.textContent = "Dit lid is al geregistreerd. Log in met dit account.";
      return;
    }
    existingClient.name = name || existingClient.name;
    existingClient.password = password;
    existingClient.registered = true;
    message.textContent = "";
    loginAs("client", existingClient.email, existingClient.name);
    form.reset();
    return;
  }

  const profile = createClientProfile({ name, email, password, registered: true });
  state.clients.push(profile);
  message.textContent = "";
  loginAs("client", profile.email, profile.name);
  form.reset();
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const role = data.get("role");
  const email = String(data.get("email")).trim().toLowerCase();
  const password = String(data.get("password"));
  const remember = form.elements.remember?.checked ?? true;
  const message = $("#loginMessage");
  message.className = "login-message";

  setRememberPreference(remember, email, role);
  if (isOnlineMode()) {
    try {
      message.textContent = "Inloggen...";
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await hydrateOnlineUser(role);
      message.textContent = "";
      form.reset();
      updateRememberControls();
      return;
    } catch (error) {
      message.className = "login-message error";
      message.textContent = role === "client" && /uitnodiging|invite|gekoppeld/i.test(error.message)
        ? "Dit lidaccount is nog niet gekoppeld. Vraag je trainer om je via e-mail toe te voegen."
        : error.message;
      return;
    }
  }

  if (role === "trainer") {
    if (!state.trainerAccount?.email) {
      message.textContent = "Registreer eerst een traineraccount.";
      return;
    }
    if (email === state.trainerAccount.email && password === state.trainerAccount.password) {
      message.textContent = "";
      loginAs("trainer", email, state.trainerAccount.name);
      form.reset();
      return;
    }
  }

  if (role === "client") {
    const selected = state.clients.find((item) => item.registered && item.email === email && String(item.password) === password);
    if (selected) {
      message.textContent = "";
      loginAs("client", selected.email, selected.name);
      form.reset();
      return;
    }
  }

  message.textContent = "E-mail, wachtwoord of account type klopt niet.";
});

$("#logoutButton").addEventListener("click", async () => {
  if (isOnlineMode()) {
    await supabaseClient.auth.signOut();
    onlineProfile = null;
    onlineReady = false;
  }
  logout();
});

$("#clientForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await addClient(event.currentTarget);
});

$("#goalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const selected = client();
  const data = new FormData(event.currentTarget);
  selected.planSummary = data.get("planSummary") || "";
  selected.goal = data.get("goal") || "";
  Object.keys(DEFAULT_GOALS).forEach((key) => {
    if (!event.currentTarget.elements[key]) return;
    const value = data.get(key);
    selected.goals[key] = value === "" ? "" : number(value);
  });
  renderAll();
});

$("#trainingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  client().trainingPlan.push({
    day: data.get("day"),
    exercise: data.get("exercise"),
    sets: number(data.get("sets")),
    reps: data.get("reps"),
    tempo: data.get("tempo"),
    rest: data.get("rest"),
    actualSets: "",
    actualReps: "",
    notes: ""
  });
  event.currentTarget.reset();
  renderAll();
});

$("#nutritionPlanForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  client().nutritionPlan.push({
    meal: data.get("meal"),
    items: data.get("items"),
    kcal: number(data.get("kcal")),
    protein: number(data.get("protein")),
    carbs: number(data.get("carbs")),
    fat: number(data.get("fat")),
    status: "",
    alternative: ""
  });
  event.currentTarget.reset();
  renderAll();
});

$("#recipeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  recipeOptions = generateRecipes({
    kcal: number(data.get("kcal")),
    protein: number(data.get("protein")),
    carbs: number(data.get("carbs")),
    fat: number(data.get("fat"))
  }, data.get("mealType"), data.get("style"));
  $("#recipeOutput").innerHTML = `
    <div class="recipe-output-head">
      <strong>${mealTypeLabel(data.get("mealType"))} opties</strong>
      <span>Doel per optie: ${fmt(number(data.get("kcal")))} kcal | ${fmt(number(data.get("protein")))}g eiwit | ${fmt(number(data.get("carbs")))}g kh | ${fmt(number(data.get("fat")))}g vet</span>
    </div>
    <div class="recipe-option-grid">
      ${recipeOptions.map((recipe, index) => `
        <div class="recipe-option-card">
          <div>
            <span class="recipe-style">${recipe.style.replace("-", " ")}</span>
            <strong>${recipe.name}</strong>
          </div>
          <ul class="ingredient-list">
            ${recipe.rows.map((item) => `<li><span>${item.name}</span><strong>${formatRecipeAmount(item.grams)}</strong></li>`).join("")}
          </ul>
          <p>${fmt(recipe.totals.kcal)} kcal | ${fmt(recipe.totals.protein)}g eiwit | ${fmt(recipe.totals.carbs)}g kh | ${fmt(recipe.totals.fat)}g vet</p>
          <button class="primary-btn" data-add-recipe-option="${index}" type="button">Kies voor voedingsplan</button>
        </div>
      `).join("")}
    </div>
  `;
});

$("#macroForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const product = productById(data.get("product"));
  const grams = number(data.get("grams"));
  if (!product || !grams) return;
  state.trainerCalc.push(foodEntryFromProduct(product, grams, "g", "Trainerberekening"));
  renderAll();
});

$("#foodEntryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const product = productById(data.get("product"));
  const amount = number(data.get("amount"));
  const unit = data.get("unit");
  if (!product || !amount) return;
  client().foodLog.push({
    ...foodEntryFromProduct(product, amount, unit, data.get("note") || ""),
    date: data.get("date") || activeWeekStart()
  });
  event.currentTarget.elements.note.value = "";
  renderAll();
});

$("#measurementForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  client().measurements.push({
    week: data.get("week"),
    weight: number(data.get("weight")),
    waist: number(data.get("waist")),
    chest: number(data.get("chest")),
    arm: number(data.get("arm")),
    leg: number(data.get("leg"))
  });
  event.currentTarget.reset();
  renderAll();
});

$("#appointmentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const selected = state.clients.find((item) => item.id === data.get("clientId"));
  if (!selected) return;
  selected.appointments.push({
    id: `a${Date.now()}`,
    date: data.get("date"),
    day: dayNameFromDate(data.get("date")),
    time: data.get("time"),
    type: data.get("type") || "Afspraak"
  });
  event.currentTarget.reset();
  renderAll();
});

$("#notificationPermission").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Browsermeldingen zijn niet beschikbaar.");
    return;
  }
  await Notification.requestPermission();
  renderAll();
});

document.addEventListener("input", (event) => {
  const target = event.target;
  const selected = client();
  if (target.dataset.trainingLog) {
    const [index, key] = target.dataset.trainingLog.split(":");
    if (selected.trainingPlan[Number(index)]) {
      exerciseWeekLog(selected.trainingPlan[Number(index)])[key] = target.value;
      saveState();
    }
  }
  if (target.dataset.stepIndex) {
    weekArray(selected, "stepsByWeek", "value")[Number(target.dataset.stepIndex)].value = target.value;
    saveState();
  }
  if (target.dataset.weightIndex) {
    selected.dailyWeight[Number(target.dataset.weightIndex)].value = target.value;
    saveState();
  }
  if (target.dataset.wellbeing) {
    const [index, key] = target.dataset.wellbeing.split(":");
    weekArray(selected, "wellbeingByWeek", "energy", { stress: "", motivation: "", mood: "" })[Number(index)][key] = target.value;
    saveState();
  }
  if (target.dataset.sleep) {
    const [index, key] = target.dataset.sleep.split(":");
    weekArray(selected, "sleepByWeek", "hours", { quality: "", bed: "", wake: "" })[Number(index)][key] = target.value;
    saveState();
  }
  if (target.dataset.waterDayInput) {
    setWaterDay(selected, target.dataset.waterDayInput, target.value);
    saveState();
  }
  if (target.dataset.mealAlternative) {
    mealWeekLog(selected.nutritionPlan[Number(target.dataset.mealAlternative)]).alternative = target.value;
    saveState();
  }
});

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-drag-appointment]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.dragAppointment);
});

document.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-calendar-date]")) event.preventDefault();
});

document.addEventListener("drop", (event) => {
  const column = event.target.closest("[data-calendar-date]");
  if (!column) return;
  event.preventDefault();
  const payload = event.dataTransfer.getData("text/plain");
  const [clientId, appointmentId] = payload.split(":");
  const selected = state.clients.find((item) => item.id === clientId);
  const appointment = selected?.appointments.find((item) => item.id === appointmentId);
  if (!appointment) return;
  appointment.date = column.dataset.calendarDate;
  appointment.day = dayNameFromDate(appointment.date);
  renderAll();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  const selected = client();
  if (target.dataset.weightIndex) {
    selected.dailyWeight[Number(target.dataset.weightIndex)].value = target.value;
    renderAll();
  }
  if (target.dataset.wellbeing) {
    const [index, key] = target.dataset.wellbeing.split(":");
    weekArray(selected, "wellbeingByWeek", "energy", { stress: "", motivation: "", mood: "" })[Number(index)][key] = target.value;
    renderAll();
  }
  if (target.dataset.sleep) {
    const [index, key] = target.dataset.sleep.split(":");
    weekArray(selected, "sleepByWeek", "hours", { quality: "", bed: "", wake: "" })[Number(index)][key] = target.value;
    renderAll();
  }
  if (target.dataset.waterDayInput) {
    setWaterDay(selected, target.dataset.waterDayInput, target.value);
    renderAll();
  }
  if (target.dataset.mealStatus) {
    mealWeekLog(selected.nutritionPlan[Number(target.dataset.mealStatus)]).status = target.value;
    renderAll();
  }
  if (target.dataset.mealAlternative) {
    mealWeekLog(selected.nutritionPlan[Number(target.dataset.mealAlternative)]).alternative = target.value;
    renderAll();
  }
});

async function init() {
  document.body.classList.toggle("light", state.ui.theme === "light");
  updateRememberControls();
  renderNav();
  renderAll();
  showView(currentView);
  if (isOnlineMode()) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (data?.session) {
        await hydrateOnlineUser();
      }
      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          onlineProfile = null;
          onlineReady = false;
        }
      });
    } catch (error) {
      syncStatus("Online fout", "error");
      const message = $("#loginMessage");
      if (message && !isLoggedIn()) {
        message.className = "login-message error";
        message.textContent = error.message;
      }
    }
  }
}

init();
