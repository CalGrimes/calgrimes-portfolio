import { ValidSkills } from "./constants";

export interface ExperienceInterface {
  id: string;
  position: string;
  company: string;
  location: string;
  startDate: Date;
  endDate: Date | "Present";
  description: string[];
  achievements: string[];
  skills: ValidSkills[];
  companyUrl?: string;
  logo?: string;
}

export const experiences: ExperienceInterface[] = [
  {
    id: "barclays",
    position: "Solution Architect (Risk Finance & Treasury)",
    company: "Barclays",
    location: "United Kingdom",
    startDate: new Date("2025-07-04"),
    endDate: "Present",
    description: [],
    achievements: [],
    skills: [
      "Solution Architecture",
      "Enterprise Architecture",
      "Cloud Adoption",
      "C4 Diagrams",
      "Governance",
      "SaaS Vendor Onboarding",
      "GenAI",
      "Containerisation",
      "Roadmap Planning",
      "Stakeholder Management",
      "RFI Evaluation",
      "Risk & Finance",
    ],
    companyUrl: "https://www.barclays.co.uk/",
    logo: "/experience/barclays.png",
  },
  {
    id: "itv",
    position: "Technical Integration Analyst",
    company: "ITV",
    location: "United Kingdom",
    startDate: new Date("2024-07-28"),
    endDate: new Date("2025-07-01"),
    description: [],
    achievements: [],
    skills: [
      "Oracle",
      "EBS",
      "ETL",
      "Salesforce",
      "REST",
      "SOAP",
      "Data Engineering",
      "Solution Architecture",
    ],
    companyUrl: "https://www.itv.com/",
    logo: "/experience/ITV.svg",
  },
  {
    id: "vldb",
    position: "Software Developer",
    company: "VLDB Solutions",
    location: "United Kingdom",
    startDate: new Date("2022-07-20"),
    endDate: new Date("2024-07-28"),
    description: [
      "Manipulates tens of thousands of SQL queries in a single instance using Java. SQL Dialects are converted in multiple stages and tested using JDBC",
      "Terraformed the infrastructure for a Kafka cluster on AWS. The cluster was used to stream data between between various microservices. This replaced an existing solution using Confluent Kafka, saving >20% in annual costs.",
      "Maintanance, bug fixes and new features for a risk management system using .NET and SQL Server.",
    ],
    achievements: [
      "SQL Transpiler (CLI): Manipulates tens of thousands of SQL queries in a single instance using Java. SQL Dialects are converted in multiple stages and tested using JDBC",
      "Amazon MSK implementation (Terraform): Terraformed the infrastructure for a Kafka cluster on AWS. The cluster was used to stream data between between various microservices. This replaced an existing solution using Confluent Kafka, saving >20% in annual costs.",
      "Risk Management System (Full Stack): Maintanance, bug fixes and new features for a risk management system using .NET and SQL Server.",
    ],
    skills: [
      "Azure",
      "Java",
      "Python",
      "SQL",
      "AWS",
      ".NET",
      "Terraform",
      "Kafka",
    ],
    companyUrl: "https://vldbsolutions.com/",
    logo: "/experience/VLDB.svg",
  },
];
