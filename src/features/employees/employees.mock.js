// Mock-only lists and helpers used to build the sample employees below.
const DEPTS = ["Engineering","Human Resources","Finance","Operations","Marketing","Sales","Legal","Administration"];
const LOCS = ["Mumbai","Delhi","Bangalore","Chennai","Hyderabad","Pune"];
const PLANTS = ["BLRF","HP","HSR","MYSR"];
const GRADES = ["A","B","C","D","E"];
const DESIGS = [
  "Software Engineer","Senior Software Engineer","Tech Lead","Engineering Manager",
  "HR Executive","HR Manager","Finance Analyst","Finance Manager",
  "Operations Executive","Operations Manager","Marketing Executive","Marketing Manager",
  "Sales Executive","Sales Manager","Legal Counsel","Admin Executive","Director","VP","Analyst"
];
const FIRST_NAMES = ["Rahul","Priya","Amit","Sneha","Vikram","Anjali","Suresh","Kavya","Arjun","Deepa","Kiran","Nisha","Ravi","Meera","Sanjay","Pooja","Anil","Rekha","Rajesh","Sunita","Manoj","Geeta","Nitin","Shweta","Vinod","Harish","Usha","Prakash","Divya","Rohit","Shreya","Ajay","Bhavna","Sunil","Archana","Ramesh","Seema","Naveen","Gaurav","Ritu","Vivek","Manisha","Lokesh","Swati","Chetan","Anita","Sujata","Kishore","Pallavi","Arvind"];
const LAST_NAMES = ["Sharma","Verma","Singh","Gupta","Kumar","Patel","Shah","Mehta","Joshi","Chopra","Malhotra","Reddy","Nair","Iyer","Pillai","Rao","Naidu","Murthy","Pandey","Srivastava","Agarwal","Bansal","Kapoor","Sinha","Mishra","Tiwari","Dubey","Yadav","Chauhan","Thakur","Bose","Ghosh","Chatterjee","Mukherjee","Das","Roy","Sen","Biswas","Paul","Chowdhury","Dutta","Banerjee","Sarkar","Mondal","Kulkarni","Desai","Patil","More","Jadhav","Shinde"];

const seed = (n) => {
  let x = Math.sin(n + 1) * 10000;
  return x - Math.floor(x);
};

function genDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}


const STREETS = ["Green Layout","MG Road","Church Street","Lake View Colony","Palm Grove","Silver Oak Avenue","Rose Garden"];
const CITIES_BY_LOC = {
  Mumbai: ["Mumbai","Maharashtra","400001"], Delhi: ["New Delhi","Delhi","110001"],
  Bangalore: ["Bangalore","Karnataka","560068"], Chennai: ["Chennai","Tamil Nadu","600001"],
  Hyderabad: ["Hyderabad","Telangana","500001"], Pune: ["Pune","Maharashtra","411001"],
};

export function genEmployees() {
  const names = Array.from({ length: 50 }, (_, i) => {
    const fi = Math.floor(seed(i * 3) * FIRST_NAMES.length);
    const li = Math.floor(seed(i * 7) * LAST_NAMES.length);
    return `${FIRST_NAMES[fi]} ${LAST_NAMES[li]}`;
  });
  return Array.from({ length: 50 }, (_, i) => {
    const name = names[i];
    const di = Math.floor(seed(i * 11) * DEPTS.length);
    const loi = Math.floor(seed(i * 13) * LOCS.length);
    const desi = Math.floor(seed(i * 17) * DESIGS.length);
    const mi = Math.floor(seed(i * 19) * 6);
    const dept = DEPTS[di];
    const location = LOCS[loi];
    const [city, state, pincode] = CITIES_BY_LOC[location];
    const statuses = ["Active","Active","Active","Active","Inactive","On Leave"];
    const sts = statuses[Math.floor(seed(i * 23) * statuses.length)];
    return {
      id: `EMP${String(i + 1).padStart(3,"0")}`,
      empCode: `AMS${String(1000 + i + 1)}`,
      name,
      designation: DESIGS[desi],
      department: dept,
      email: `${name.toLowerCase().replace(" ",".")}@company.com`,
      mobile: `+91 ${Math.floor(seed(i*29)*9000000000 + 6000000000)}`,
      manager: i === 0 ? "Board of Directors" : i < 6 ? `${names[0]} (CEO)` : names[mi],
      status: sts,
      location,
      plant: PLANTS[Math.floor(seed(i*37) * PLANTS.length)],
      grade: GRADES[Math.floor(seed(i*41) * GRADES.length)],
      address: `${Math.floor(seed(i*43)*200)+1}, ${STREETS[Math.floor(seed(i*47)*STREETS.length)]}, ${city}, ${state} - ${pincode}, India`,
      joinDate: genDate(Math.floor(seed(i*31) * 1800 + 90)),
    };
  });
}

// Seed array — the source of truth used by other features' one-off derived lookups (currently:
// employees.roles.js's getEmployeeRole() reportee check). Live edits go through
// employees.store.js instead.
export const EMPLOYEES = genEmployees();
export const CURRENT_USER = EMPLOYEES[1];
