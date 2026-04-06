import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

interface CourseDefinition {
  name: string;
  subject: string;
  description: string;
}

interface QuestionDefinition {
  type: 'mc' | 'tf' | 'short' | 'order' | 'bingo_term';
  question: string;
  options?: string[];
  answer: string;
  hint?: string;
  points: number;
  time_limit: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// ── Course definitions ────────────────────────────────────────────────────────
const COURSES: CourseDefinition[] = [
  {
    name: 'IT Fundamentals',
    subject: 'IT101',
    description: 'Introduction to information technology concepts, hardware, software, and basic operations.',
  },
  {
    name: 'Networking Fundamentals',
    subject: 'IT200',
    description: 'Core networking concepts including OSI model, TCP/IP, protocols, and network devices.',
  },
  {
    name: 'Cybersecurity Basics',
    subject: 'IT215',
    description: 'Foundations of cybersecurity, threats, defenses, encryption, and security best practices.',
  },
  {
    name: 'Computer Hardware & Systems',
    subject: 'IT150',
    description: 'PC components, assembly, troubleshooting, operating systems, and system maintenance.',
  },
  {
    name: 'Introduction to Programming',
    subject: 'CS101',
    description: 'Programming fundamentals using Python: variables, loops, functions, and basic algorithms.',
  },
  {
    name: 'Database Management',
    subject: 'IT260',
    description: 'Relational database design, SQL, normalization, transactions, and database administration.',
  },
];

// ── Questions by course ───────────────────────────────────────────────────────

function it101Questions(): QuestionDefinition[] {
  return [
    // MC
    { type: 'mc', question: 'What does CPU stand for?', options: ['Central Processing Unit','Central Program Utility','Computer Processing Utility','Central Peripheral Unit'], answer: 'Central Processing Unit', category: 'Hardware', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which of the following is an example of an operating system?', options: ['Microsoft Word','Google Chrome','Windows 11','Adobe Photoshop'], answer: 'Windows 11', category: 'Software', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What unit measures processor clock speed?', options: ['Bytes','Hertz','Watts','Pixels'], answer: 'Hertz', category: 'Hardware', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which type of memory is volatile (loses data when power is off)?', options: ['SSD','HDD','ROM','RAM'], answer: 'RAM', category: 'Hardware', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What is the function of the BIOS/UEFI?', options: ['Manage antivirus software','Initialize hardware during startup','Store user files','Control network traffic'], answer: 'Initialize hardware during startup', category: 'Systems', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'Which component connects all internal computer components together?', options: ['Power Supply','Motherboard','Graphics Card','Heat Sink'], answer: 'Motherboard', category: 'Hardware', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What does GUI stand for?', options: ['General User Interface','Graphical User Interface','Global Unified Interface','Guided Utility Interface'], answer: 'Graphical User Interface', category: 'Software', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'How many bits are in one byte?', options: ['4','16','8','2'], answer: '8', category: 'Fundamentals', difficulty: 'easy', points: 100, time_limit: 15 },
    // TF
    { type: 'tf', question: 'A solid-state drive (SSD) has moving mechanical parts.', options: ['True','False'], answer: 'False', hint: 'Think about what "solid-state" means.', category: 'Hardware', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'tf', question: 'The operating system acts as an interface between the user and the hardware.', options: ['True','False'], answer: 'True', category: 'Software', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'tf', question: 'USB stands for Universal Serial Bus.', options: ['True','False'], answer: 'True', category: 'Hardware', difficulty: 'easy', points: 100, time_limit: 15 },
    { type: 'tf', question: 'A terabyte (TB) is smaller than a gigabyte (GB).', options: ['True','False'], answer: 'False', category: 'Fundamentals', difficulty: 'easy', points: 100, time_limit: 15 },
    { type: 'tf', question: 'Open-source software can be freely modified and distributed.', options: ['True','False'], answer: 'True', category: 'Software', difficulty: 'medium', points: 100, time_limit: 20 },
  ];
}

function it200Questions(): QuestionDefinition[] {
  return [
    { type: 'mc', question: 'What does OSI stand for?', options: ['Open Systems Interconnection','Open Source Interface','Operating System Interface','Open Software Integration'], answer: 'Open Systems Interconnection', category: 'Models', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'How many layers does the OSI model have?', options: ['4','5','7','8'], answer: '7', category: 'Models', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which protocol assigns IP addresses automatically on a network?', options: ['DNS','DHCP','FTP','SMTP'], answer: 'DHCP', category: 'Protocols', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What is the default subnet mask for a Class C network?', options: ['255.0.0.0','255.255.0.0','255.255.255.0','255.255.255.255'], answer: '255.255.255.0', category: 'IP Addressing', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'Which device operates at Layer 3 (Network layer) of the OSI model?', options: ['Hub','Switch','Router','Repeater'], answer: 'Router', category: 'Devices', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What port does HTTPS use by default?', options: ['80','21','443','22'], answer: '443', category: 'Protocols', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'Which topology connects every device directly to a central switch?', options: ['Bus','Ring','Mesh','Star'], answer: 'Star', category: 'Topologies', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What does TCP stand for?', options: ['Transfer Control Protocol','Transmission Control Protocol','Transport Communication Protocol','Transmission Communication Procedure'], answer: 'Transmission Control Protocol', category: 'Protocols', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which layer of the OSI model is responsible for end-to-end communication and reliability?', options: ['Network','Session','Data Link','Transport'], answer: 'Transport', category: 'Models', difficulty: 'hard', points: 150, time_limit: 30 },
    { type: 'mc', question: 'What does DNS stand for?', options: ['Dynamic Network Service','Domain Name System','Data Name Server','Distributed Network System'], answer: 'Domain Name System', category: 'Protocols', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'tf', question: 'UDP is a connection-oriented protocol that guarantees packet delivery.', options: ['True','False'], answer: 'False', hint: 'UDP is connectionless.', category: 'Protocols', difficulty: 'medium', points: 100, time_limit: 20 },
    { type: 'tf', question: 'A MAC address is a hardware address burned into a network interface card.', options: ['True','False'], answer: 'True', category: 'Devices', difficulty: 'medium', points: 100, time_limit: 20 },
    { type: 'tf', question: 'The loopback address for IPv4 is 127.0.0.1.', options: ['True','False'], answer: 'True', category: 'IP Addressing', difficulty: 'easy', points: 100, time_limit: 20 },
  ];
}

function it215Questions(): QuestionDefinition[] {
  return [
    { type: 'mc', question: 'What does CIA stand for in cybersecurity?', options: ['Confidentiality, Integrity, Availability','Central Intelligence Agency','Computer Information Access','Critical Infrastructure Assessment'], answer: 'Confidentiality, Integrity, Availability', category: 'Fundamentals', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What type of malware disguises itself as legitimate software?', options: ['Worm','Spyware','Trojan Horse','Ransomware'], answer: 'Trojan Horse', category: 'Malware', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What is the process of converting readable data into an unreadable format called?', options: ['Hashing','Encoding','Encryption','Compression'], answer: 'Encryption', category: 'Cryptography', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which attack involves overwhelming a server with traffic to make it unavailable?', options: ['Phishing','Man-in-the-Middle','DDoS','SQL Injection'], answer: 'DDoS', category: 'Attacks', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What is phishing?', options: ['A network scanning technique','A social engineering attack using fake emails/websites','A type of encryption','A firewall bypass method'], answer: 'A social engineering attack using fake emails/websites', category: 'Social Engineering', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which of these is an example of multi-factor authentication?', options: ['Using a long password','Using password + fingerprint','Using two different passwords','Changing your password frequently'], answer: 'Using password + fingerprint', category: 'Authentication', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What does a firewall primarily do?', options: ['Speeds up internet connection','Backs up data','Monitors and controls network traffic based on rules','Encrypts files on disk'], answer: 'Monitors and controls network traffic based on rules', category: 'Defense', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What is a zero-day vulnerability?', options: ['A vulnerability with no patch available','A vulnerability fixed in zero days','An attack that runs at midnight','A bug in antivirus software'], answer: 'A vulnerability with no patch available', category: 'Vulnerabilities', difficulty: 'hard', points: 150, time_limit: 30 },
    { type: 'tf', question: 'HTTPS provides encrypted communication between a browser and a web server.', options: ['True','False'], answer: 'True', category: 'Protocols', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'tf', question: 'A strong password should contain a mix of uppercase, lowercase, numbers, and symbols.', options: ['True','False'], answer: 'True', category: 'Authentication', difficulty: 'easy', points: 100, time_limit: 15 },
    { type: 'tf', question: 'A VPN hides your IP address and encrypts your internet traffic.', options: ['True','False'], answer: 'True', category: 'Defense', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'tf', question: 'SQL injection attacks target vulnerabilities in network hardware.', options: ['True','False'], answer: 'False', hint: 'SQL injection targets web application databases.', category: 'Attacks', difficulty: 'medium', points: 100, time_limit: 20 },
  ];
}

function it150Questions(): QuestionDefinition[] {
  return [
    { type: 'mc', question: 'What does POST stand for in computer startup?', options: ['Power On Self Test','Program Operating System Test','Processing Output System Test','Primary Operating Startup Test'], answer: 'Power On Self Test', category: 'Systems', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'Which connector type is most commonly used to connect modern storage drives?', options: ['IDE','SCSI','SATA','Parallel'], answer: 'SATA', category: 'Hardware', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What is the purpose of thermal paste on a CPU?', options: ['Lubricate the fan','Improve electrical conductivity','Transfer heat from CPU to heatsink','Prevent electrostatic discharge'], answer: 'Transfer heat from CPU to heatsink', category: 'Hardware', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What does GPU stand for?', options: ['General Processing Unit','Graphical Processing Unit','Graphics Processing Unit','General Purpose Unit'], answer: 'Graphics Processing Unit', category: 'Hardware', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which tool should you use to prevent ESD damage when handling computer components?', options: ['Rubber gloves','Antistatic wrist strap','Cotton gloves','Plastic screwdriver'], answer: 'Antistatic wrist strap', category: 'Safety', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What is the purpose of the PSU in a computer?', options: ['Store data','Process instructions','Convert AC power to DC power for components','Control network access'], answer: 'Convert AC power to DC power for components', category: 'Hardware', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which type of RAM slot arrangement gives the best dual-channel performance?', options: ['Slots 1 and 2','Slots 1 and 3','Slots 2 and 3','Any two slots'], answer: 'Slots 1 and 3', category: 'Hardware', difficulty: 'hard', points: 150, time_limit: 30 },
    { type: 'mc', question: 'What command in Windows checks disk errors?', options: ['DISKPART','CHKDSK','IPCONFIG','SCONFIG'], answer: 'CHKDSK', category: 'Troubleshooting', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'tf', question: 'DDR4 RAM is faster and more energy efficient than DDR3.', options: ['True','False'], answer: 'True', category: 'Hardware', difficulty: 'medium', points: 100, time_limit: 20 },
    { type: 'tf', question: 'Formatting a hard drive removes all data from the drive.', options: ['True','False'], answer: 'True', category: 'Storage', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'tf', question: 'NVMe SSDs use the SATA interface.', options: ['True','False'], answer: 'False', hint: 'NVMe uses the PCIe interface.', category: 'Hardware', difficulty: 'hard', points: 150, time_limit: 30 },
    { type: 'tf', question: 'A BIOS update (firmware update) can improve CPU compatibility and fix bugs.', options: ['True','False'], answer: 'True', category: 'Systems', difficulty: 'medium', points: 100, time_limit: 20 },
  ];
}

function cs101Questions(): QuestionDefinition[] {
  return [
    { type: 'mc', question: 'What is the output of: print(2 ** 3) in Python?', options: ['6','8','9','5'], answer: '8', category: 'Python Basics', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which keyword is used to define a function in Python?', options: ['function','define','func','def'], answer: 'def', category: 'Functions', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What data type does the Python function input() return?', options: ['int','float','str','bool'], answer: 'str', category: 'Python Basics', difficulty: 'medium', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which loop in Python is best when you know the exact number of iterations?', options: ['while loop','do-while loop','for loop','repeat loop'], answer: 'for loop', category: 'Loops', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What is the index of the first element in a Python list?', options: ['-1','1','0','First'], answer: '0', category: 'Data Structures', difficulty: 'easy', points: 100, time_limit: 15 },
    { type: 'mc', question: 'What symbol is used for single-line comments in Python?', options: ['//','/* */','#','--'], answer: '#', category: 'Python Basics', difficulty: 'easy', points: 100, time_limit: 15 },
    { type: 'mc', question: 'Which of these is NOT a Python data type?', options: ['int','str','float','char'], answer: 'char', category: 'Python Basics', difficulty: 'medium', points: 100, time_limit: 25 },
    { type: 'mc', question: 'What does the len() function do in Python?', options: ['Returns the last element','Returns the length of an object','Converts to list','Prints to console'], answer: 'Returns the length of an object', category: 'Functions', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What is the time complexity of a linear search algorithm?', options: ['O(1)','O(log n)','O(n)','O(n²)'], answer: 'O(n)', category: 'Algorithms', difficulty: 'hard', points: 150, time_limit: 30 },
    { type: 'tf', question: 'In Python, indentation is used to define code blocks.', options: ['True','False'], answer: 'True', category: 'Python Basics', difficulty: 'easy', points: 100, time_limit: 15 },
    { type: 'tf', question: 'A variable must be declared with a specific type in Python.', options: ['True','False'], answer: 'False', hint: 'Python uses dynamic typing.', category: 'Python Basics', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'tf', question: 'The range(5) function in Python produces the numbers 1, 2, 3, 4, 5.', options: ['True','False'], answer: 'False', hint: 'range() starts at 0 by default.', category: 'Loops', difficulty: 'medium', points: 100, time_limit: 20 },
    { type: 'tf', question: 'Python lists can hold elements of different data types.', options: ['True','False'], answer: 'True', category: 'Data Structures', difficulty: 'easy', points: 100, time_limit: 15 },
  ];
}

function it260Questions(): QuestionDefinition[] {
  return [
    { type: 'mc', question: 'What does SQL stand for?', options: ['Structured Query Language','Simple Query Logic','System Query Language','Structured Question Language'], answer: 'Structured Query Language', category: 'SQL Basics', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which SQL statement is used to retrieve data from a database?', options: ['INSERT','UPDATE','SELECT','FETCH'], answer: 'SELECT', category: 'SQL Basics', difficulty: 'easy', points: 100, time_limit: 15 },
    { type: 'mc', question: 'What is a primary key?', options: ['A key used for encryption','A column that uniquely identifies each row in a table','The first column of any table','A foreign key reference'], answer: 'A column that uniquely identifies each row in a table', category: 'Database Design', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'Which SQL clause is used to filter results?', options: ['GROUP BY','ORDER BY','WHERE','HAVING'], answer: 'WHERE', category: 'SQL Basics', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What is normalization in databases?', options: ['Speeding up queries','Organizing data to reduce redundancy and improve integrity','Encrypting database files','Backing up the database'], answer: 'Organizing data to reduce redundancy and improve integrity', category: 'Database Design', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'What type of JOIN returns all rows from both tables, with NULLs where no match exists?', options: ['INNER JOIN','LEFT JOIN','RIGHT JOIN','FULL OUTER JOIN'], answer: 'FULL OUTER JOIN', category: 'SQL Advanced', difficulty: 'hard', points: 150, time_limit: 30 },
    { type: 'mc', question: 'Which SQL aggregate function returns the number of rows?', options: ['SUM()','AVG()','COUNT()','MAX()'], answer: 'COUNT()', category: 'SQL Functions', difficulty: 'easy', points: 100, time_limit: 20 },
    { type: 'mc', question: 'What is a foreign key?', options: ['A key from another database','A column that references the primary key of another table','A key used for remote access','An encrypted primary key'], answer: 'A column that references the primary key of another table', category: 'Database Design', difficulty: 'medium', points: 100, time_limit: 30 },
    { type: 'mc', question: 'Which normal form eliminates partial dependencies?', options: ['1NF','2NF','3NF','BCNF'], answer: '2NF', category: 'Normalization', difficulty: 'hard', points: 150, time_limit: 30 },
    { type: 'tf', question: 'A table can have multiple primary keys.', options: ['True','False'], answer: 'False', hint: 'A table can only have ONE primary key (but it can be composite).', category: 'Database Design', difficulty: 'medium', points: 100, time_limit: 20 },
    { type: 'tf', question: 'NULL in SQL means the value is zero.', options: ['True','False'], answer: 'False', hint: 'NULL means the value is unknown or missing.', category: 'SQL Basics', difficulty: 'medium', points: 100, time_limit: 20 },
    { type: 'tf', question: 'An INDEX in a database can improve the speed of SELECT queries.', options: ['True','False'], answer: 'True', category: 'Performance', difficulty: 'medium', points: 100, time_limit: 20 },
    { type: 'tf', question: 'The GROUP BY clause must be used with an aggregate function.', options: ['True','False'], answer: 'True', category: 'SQL Advanced', difficulty: 'hard', points: 150, time_limit: 25 },
  ];
}

const COURSE_QUESTIONS: Record<string, () => QuestionDefinition[]> = {
  'IT Fundamentals': it101Questions,
  'Networking Fundamentals': it200Questions,
  'Cybersecurity Basics': it215Questions,
  'Computer Hardware & Systems': it150Questions,
  'Introduction to Programming': cs101Questions,
  'Database Management': it260Questions,
};

// ── Seed function ─────────────────────────────────────────────────────────────

export function seedDatabase(db: Database.Database): void {
  // Check if courses are already seeded
  const courseCount = (db.prepare('SELECT COUNT(*) as count FROM courses').get() as { count: number }).count;
  if (courseCount > 0) {
    logger.info('Database already seeded, skipping.');
    return;
  }

  logger.info('Seeding database with courses and questions...');

  const insertCourse = db.prepare(`
    INSERT INTO courses (name, subject, description) VALUES (?, ?, ?)
  `);
  const insertBank = db.prepare(`
    INSERT INTO question_banks (course_id, name, exam_type, difficulty) VALUES (?, ?, ?, 'mixed')
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO questions (bank_id, type, question, options, answer, hint, points, time_limit, category, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const bankTypes: Array<{ name: string; exam_type: 'general' | 'midterm' | 'final' }> = [
    { name: 'General Review',  exam_type: 'general' },
    { name: 'Midterm Review',  exam_type: 'midterm' },
    { name: 'Final Review',    exam_type: 'final'   },
  ];

  const seed = db.transaction(() => {
    for (const course of COURSES) {
      const courseResult = insertCourse.run(course.name, course.subject, course.description);
      const courseId = courseResult.lastInsertRowid as number;

      const questionsForCourse = COURSE_QUESTIONS[course.name]?.() ?? [];

      for (const bankDef of bankTypes) {
        const bankResult = insertBank.run(courseId, bankDef.name, bankDef.exam_type);
        const bankId = bankResult.lastInsertRowid as number;

        // All banks get all questions (they can be filtered/customized later)
        for (const q of questionsForCourse) {
          insertQuestion.run(
            bankId,
            q.type,
            q.question,
            q.options ? JSON.stringify(q.options) : null,
            q.answer,
            q.hint ?? null,
            q.points,
            q.time_limit,
            q.category,
            q.difficulty,
          );
        }
      }
    }
  });

  seed();
  logger.info('Database seeding complete.');
}
