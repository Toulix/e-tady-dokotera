import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

// Prisma 7 requires the PrismaPg adapter — the old URL-only constructor is gone.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Realistic Malagasy doctor seed data.
// Names follow common Malagasy naming conventions (Rakoto, Randria, Rabe, etc.).
// Specialties are in French — the medical language used in Madagascar.
// Coordinates cluster around Antananarivo with slight variation to simulate
// real clinic/hospital locations across the capital region.
const SEED_DOCTORS = [
  {
    firstName: 'Hery',
    lastName: 'Rakotomalala',
    phoneNumber: '+261340000001',
    registrationNumber: 'MED-2024-0001',
    specialties: ['Médecine Générale'],
    subSpecialties: [],
    yearsOfExperience: 15,
    about: 'Médecin généraliste avec 15 ans d\'expérience à Antananarivo. Consultations en malgache et français.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 60000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine', university: 'Université d\'Antananarivo', year: 2009 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2009-1234' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Cabinet Médical Analakely',
      type: 'clinic' as const,
      address: 'Rue Rainitovo, Analakely',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9105,
      lng: 47.5255,
    },
  },
  {
    firstName: 'Nirina',
    lastName: 'Rabemananjara',
    phoneNumber: '+261340000002',
    registrationNumber: 'MED-2024-0002',
    specialties: ['Cardiologie'],
    subSpecialties: ['Échocardiographie'],
    yearsOfExperience: 20,
    about: 'Cardiologue spécialisé en échocardiographie. Ancien chef de service au CHU Befelatanana.',
    languagesSpoken: ['malagasy', 'french', 'english'],
    consultationFeeMga: 150000,
    consultationDurationMinutes: 45,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Spécialité Cardiologie', university: 'Université de Bordeaux', year: 2004 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2004-5678' },
    insuranceAccepted: ['OSTIE', 'CNaPS', 'Ny Havana'],
    facility: {
      name: 'CHU Joseph Ravoahangy Andrianavalona',
      type: 'hospital' as const,
      address: 'Ampefiloha',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9230,
      lng: 47.5310,
    },
  },
  {
    firstName: 'Voahirana',
    lastName: 'Randrianasolo',
    phoneNumber: '+261340000003',
    registrationNumber: 'MED-2024-0003',
    specialties: ['Pédiatrie'],
    subSpecialties: ['Néonatologie'],
    yearsOfExperience: 12,
    about: 'Pédiatre néonatologiste. Prise en charge des nouveau-nés et enfants de 0 à 15 ans.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 80000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: true,
    homeVisitEnabled: true,
    education: { degree: 'Doctorat en Médecine, Spécialité Pédiatrie', university: 'Université d\'Antananarivo', year: 2012 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2012-9012' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Clinique Pédiatrique Tsaralalàna',
      type: 'clinic' as const,
      address: 'Rue de Liège, Tsaralalàna',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9060,
      lng: 47.5230,
    },
  },
  {
    firstName: 'Andry',
    lastName: 'Rabearivelo',
    phoneNumber: '+261340000004',
    registrationNumber: 'MED-2024-0004',
    specialties: ['Chirurgie Générale'],
    subSpecialties: ['Chirurgie Laparoscopique'],
    yearsOfExperience: 18,
    about: 'Chirurgien généraliste formé en France. Spécialiste en chirurgie mini-invasive et laparoscopique.',
    languagesSpoken: ['malagasy', 'french', 'english'],
    consultationFeeMga: 120000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: false,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Spécialité Chirurgie', university: 'Université Paris Descartes', year: 2006 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2006-3456' },
    insuranceAccepted: ['OSTIE', 'CNaPS', 'Ny Havana', 'ARO'],
    facility: {
      name: 'Hôpital Militaire d\'Antananarivo',
      type: 'hospital' as const,
      address: 'Soavinandriana',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9000,
      lng: 47.5180,
    },
  },
  {
    firstName: 'Fara',
    lastName: 'Rasolofonirina',
    phoneNumber: '+261340000005',
    registrationNumber: 'MED-2024-0005',
    specialties: ['Gynécologie-Obstétrique'],
    subSpecialties: ['Grossesse à Haut Risque'],
    yearsOfExperience: 14,
    about: 'Gynécologue-obstétricienne. Suivi de grossesse, échographie obstétricale, et accouchement.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 100000,
    consultationDurationMinutes: 40,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Gynécologie-Obstétrique', university: 'Université d\'Antananarivo', year: 2010 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2010-7890' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Maternité de Befelatanana',
      type: 'hospital' as const,
      address: 'Befelatanana',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9170,
      lng: 47.5280,
    },
  },
  {
    firstName: 'Tiana',
    lastName: 'Razafindrakoto',
    phoneNumber: '+261340000006',
    registrationNumber: 'MED-2024-0006',
    specialties: ['Dermatologie'],
    subSpecialties: ['Dermatologie Tropicale'],
    yearsOfExperience: 10,
    about: 'Dermatologue spécialiste des maladies tropicales de la peau. Consultations adultes et enfants.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 90000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Dermatologie', university: 'Université d\'Antananarivo', year: 2014 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2014-2345' },
    insuranceAccepted: ['OSTIE'],
    facility: {
      name: 'Centre Dermatologique Isoraka',
      type: 'clinic' as const,
      address: 'Rue Grandidier, Isoraka',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9140,
      lng: 47.5220,
    },
  },
  {
    firstName: 'Jean-Baptiste',
    lastName: 'Rakotondravao',
    phoneNumber: '+261340000007',
    registrationNumber: 'MED-2024-0007',
    specialties: ['Ophtalmologie'],
    subSpecialties: ['Chirurgie de la Cataracte'],
    yearsOfExperience: 22,
    about: 'Ophtalmologue senior. Plus de 5000 opérations de la cataracte réalisées.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 110000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: false,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Ophtalmologie', university: 'Université de Marseille', year: 2002 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2002-6789' },
    insuranceAccepted: ['OSTIE', 'CNaPS', 'Ny Havana'],
    facility: {
      name: 'Centre Ophtalmologique d\'Antananarivo',
      type: 'clinic' as const,
      address: 'Ambohijatovo',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9085,
      lng: 47.5270,
    },
  },
  {
    firstName: 'Sahondra',
    lastName: 'Andriamanitra',
    phoneNumber: '+261340000008',
    registrationNumber: 'MED-2024-0008',
    specialties: ['Médecine Interne'],
    subSpecialties: ['Diabétologie', 'Endocrinologie'],
    yearsOfExperience: 16,
    about: 'Interniste spécialisée en diabète et maladies endocriniennes. Suivi des maladies chroniques.',
    languagesSpoken: ['malagasy', 'french', 'english'],
    consultationFeeMga: 100000,
    consultationDurationMinutes: 45,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Médecine Interne', university: 'Université d\'Antananarivo', year: 2008 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2008-0123' },
    insuranceAccepted: ['OSTIE', 'CNaPS', 'ARO'],
    facility: {
      name: 'CHU Befelatanana',
      type: 'hospital' as const,
      address: 'Befelatanana',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9175,
      lng: 47.5295,
    },
  },
  {
    firstName: 'Rivo',
    lastName: 'Ramaroson',
    phoneNumber: '+261340000009',
    registrationNumber: 'MED-2024-0009',
    specialties: ['Pneumologie'],
    subSpecialties: ['Tuberculose'],
    yearsOfExperience: 13,
    about: 'Pneumologue spécialiste de la tuberculose et des maladies respiratoires chroniques.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 90000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Pneumologie', university: 'Université d\'Antananarivo', year: 2011 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2011-4567' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Centre de Pneumologie Fenoarivo',
      type: 'clinic' as const,
      address: 'Fenoarivo',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.8980,
      lng: 47.5340,
    },
  },
  {
    firstName: 'Lalao',
    lastName: 'Ravelojaona',
    phoneNumber: '+261340000010',
    registrationNumber: 'MED-2024-0010',
    specialties: ['Psychiatrie'],
    subSpecialties: ['Psychothérapie'],
    yearsOfExperience: 11,
    about: 'Psychiatre et psychothérapeute. Prise en charge de la dépression, anxiété, et troubles du sommeil.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 80000,
    consultationDurationMinutes: 60,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Psychiatrie', university: 'Université d\'Antananarivo', year: 2013 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2013-8901' },
    insuranceAccepted: ['OSTIE'],
    facility: {
      name: 'Cabinet de Psychiatrie Analamahitsy',
      type: 'clinic' as const,
      address: 'Analamahitsy',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.8920,
      lng: 47.5450,
    },
  },
  {
    firstName: 'Nomena',
    lastName: 'Razafindrabe',
    phoneNumber: '+261340000011',
    registrationNumber: 'MED-2024-0011',
    specialties: ['ORL'],
    subSpecialties: ['Audiologie'],
    yearsOfExperience: 9,
    about: 'Oto-rhino-laryngologiste. Traitement des troubles de l\'audition, sinusites, et angines.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 85000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: false,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, ORL', university: 'Université d\'Antananarivo', year: 2015 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2015-2345' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Polyclinique d\'Ilafy',
      type: 'clinic' as const,
      address: 'Ilafy',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.8750,
      lng: 47.5380,
    },
  },
  {
    firstName: 'Miora',
    lastName: 'Raharison',
    phoneNumber: '+261340000012',
    registrationNumber: 'MED-2024-0012',
    specialties: ['Médecine Générale'],
    subSpecialties: ['Médecine Tropicale'],
    yearsOfExperience: 8,
    about: 'Médecin généraliste avec expertise en médecine tropicale. Consultations en malgache, français et anglais.',
    languagesSpoken: ['malagasy', 'french', 'english'],
    consultationFeeMga: 50000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: true,
    homeVisitEnabled: true,
    education: { degree: 'Doctorat en Médecine', university: 'Université de Mahajanga', year: 2016 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2016-6789' },
    insuranceAccepted: ['OSTIE'],
    facility: {
      name: 'Centre de Santé Ivandry',
      type: 'clinic' as const,
      address: 'Ivandry',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.8890,
      lng: 47.5410,
    },
  },
  {
    firstName: 'Patrick',
    lastName: 'Rakotondrainibe',
    phoneNumber: '+261340000013',
    registrationNumber: 'MED-2024-0013',
    specialties: ['Orthopédie'],
    subSpecialties: ['Traumatologie du Sport'],
    yearsOfExperience: 17,
    about: 'Chirurgien orthopédiste et traumatologue du sport. Traitement des fractures, entorses, et prothèses.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 130000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: false,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Orthopédie', university: 'Université de Montpellier', year: 2007 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2007-0123' },
    insuranceAccepted: ['OSTIE', 'CNaPS', 'Ny Havana', 'ARO'],
    facility: {
      name: 'Clinique Chirurgicale Anosy',
      type: 'clinic' as const,
      address: 'Anosy',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9200,
      lng: 47.5190,
    },
  },
  {
    firstName: 'Haingo',
    lastName: 'Andriamboavonjy',
    phoneNumber: '+261340000014',
    registrationNumber: 'MED-2024-0014',
    specialties: ['Neurologie'],
    subSpecialties: ['Épileptologie'],
    yearsOfExperience: 14,
    about: 'Neurologue spécialiste de l\'épilepsie et des AVC. Électroencéphalogramme disponible sur place.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 120000,
    consultationDurationMinutes: 45,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Neurologie', university: 'Université de Lyon', year: 2010 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2010-3456' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Centre Neurologique Antanimena',
      type: 'clinic' as const,
      address: 'Antanimena',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9050,
      lng: 47.5300,
    },
  },
  {
    firstName: 'Zo',
    lastName: 'Rafalimanana',
    phoneNumber: '+261340000015',
    registrationNumber: 'MED-2024-0015',
    specialties: ['Urologie'],
    subSpecialties: [],
    yearsOfExperience: 19,
    about: 'Urologue. Traitement des calculs rénaux, prostate, et infections urinaires.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 110000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: false,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Urologie', university: 'Université d\'Antananarivo', year: 2005 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2005-7890' },
    insuranceAccepted: ['OSTIE', 'CNaPS', 'Ny Havana'],
    facility: {
      name: 'Clinique Saint-Luc Ankorondrano',
      type: 'clinic' as const,
      address: 'Ankorondrano',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.8950,
      lng: 47.5250,
    },
  },
  {
    firstName: 'Anja',
    lastName: 'Ratsimbasoa',
    phoneNumber: '+261340000016',
    registrationNumber: 'MED-2024-0016',
    specialties: ['Radiologie'],
    subSpecialties: ['Échographie', 'Scanner'],
    yearsOfExperience: 11,
    about: 'Radiologue. Échographie, scanner, et imagerie par résonance magnétique.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 70000,
    consultationDurationMinutes: 20,
    videoConsultationEnabled: false,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Radiologie', university: 'Université d\'Antananarivo', year: 2013 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2013-0123' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Centre d\'Imagerie Médicale Antsahavola',
      type: 'diagnostic_center' as const,
      address: 'Antsahavola',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9070,
      lng: 47.5260,
    },
  },
  {
    firstName: 'Mamy',
    lastName: 'Andrianarisoa',
    phoneNumber: '+261340000017',
    registrationNumber: 'MED-2024-0017',
    specialties: ['Médecine Générale'],
    subSpecialties: ['Médecine du Travail'],
    yearsOfExperience: 7,
    about: 'Médecin du travail et généraliste. Visites d\'entreprise et consultations individuelles.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 50000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: true,
    homeVisitEnabled: true,
    education: { degree: 'Doctorat en Médecine', university: 'Université d\'Antananarivo', year: 2017 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2017-4567' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Cabinet Médical Andraharo',
      type: 'clinic' as const,
      address: 'Andraharo',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.8860,
      lng: 47.5360,
    },
  },
  {
    firstName: 'Bodo',
    lastName: 'Razanakolona',
    phoneNumber: '+261340000018',
    registrationNumber: 'MED-2024-0018',
    specialties: ['Gastro-entérologie'],
    subSpecialties: ['Endoscopie Digestive'],
    yearsOfExperience: 15,
    about: 'Gastro-entérologue. Endoscopie digestive haute et basse, traitement des ulcères et hépatites.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 100000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Gastro-entérologie', university: 'Université de Strasbourg', year: 2009 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2009-8901' },
    insuranceAccepted: ['OSTIE', 'CNaPS', 'ARO'],
    facility: {
      name: 'Clinique Gastro Antsirabe',
      type: 'clinic' as const,
      address: 'Antsahabe',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.8830,
      lng: 47.5290,
    },
  },
  {
    firstName: 'Lanto',
    lastName: 'Ramanantsoa',
    phoneNumber: '+261340000019',
    registrationNumber: 'MED-2024-0019',
    specialties: ['Anesthésie-Réanimation'],
    subSpecialties: ['Réanimation Chirurgicale'],
    yearsOfExperience: 13,
    about: 'Anesthésiste-réanimateur. Prise en charge péri-opératoire et réanimation en soins intensifs.',
    languagesSpoken: ['malagasy', 'french'],
    consultationFeeMga: 100000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: false,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Anesthésie-Réanimation', university: 'Université d\'Antananarivo', year: 2011 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2011-2345' },
    insuranceAccepted: ['OSTIE', 'CNaPS'],
    facility: {
      name: 'Hôpital Général de Befelatanana',
      type: 'hospital' as const,
      address: 'Befelatanana',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9180,
      lng: 47.5285,
    },
  },
  {
    firstName: 'Haja',
    lastName: 'Ranaivoson',
    phoneNumber: '+261340000020',
    registrationNumber: 'MED-2024-0020',
    specialties: ['Rhumatologie'],
    subSpecialties: ['Arthrose', 'Ostéoporose'],
    yearsOfExperience: 10,
    about: 'Rhumatologue. Traitement de l\'arthrose, polyarthrite rhumatoïde, ostéoporose et douleurs articulaires.',
    languagesSpoken: ['malagasy', 'french', 'english'],
    consultationFeeMga: 95000,
    consultationDurationMinutes: 30,
    videoConsultationEnabled: true,
    homeVisitEnabled: false,
    education: { degree: 'Doctorat en Médecine, Rhumatologie', university: 'Université de Bordeaux', year: 2014 },
    certifications: { board: 'Ordre des Médecins de Madagascar', number: 'OMM-2014-6789' },
    insuranceAccepted: ['OSTIE', 'CNaPS', 'Ny Havana'],
    facility: {
      name: 'Centre de Rhumatologie 67Ha',
      type: 'clinic' as const,
      address: '67 Hectares',
      city: 'Antananarivo',
      region: 'Analamanga',
      lat: -18.9250,
      lng: 47.5200,
    },
  },
];

async function main() {
  console.log('Seeding database with 20 doctors...\n');

  // Clean up previous seed data so the script is idempotent.
  // Delete in reverse dependency order: doctor_facilities → profiles → facilities → users.
  const seedPhones = SEED_DOCTORS.map((d) => d.phoneNumber);
  const patientPhones = ['+261320000001', '+261320000002', '+261320000003'];
  const allPhones = [...seedPhones, ...patientPhones];

  // Find existing seeded users by their deterministic phone numbers
  const existingUsers = await prisma.user.findMany({
    where: { phoneNumber: { in: allPhones } },
    select: { id: true },
  });
  const existingUserIds = existingUsers.map((u) => u.id);

  if (existingUserIds.length > 0) {
    console.log(`  Cleaning up ${existingUserIds.length} existing seed records...\n`);

    // DoctorFacility references both User and Facility — delete first
    await prisma.doctorFacility.deleteMany({
      where: { doctorId: { in: existingUserIds } },
    });
    await prisma.doctorProfile.deleteMany({
      where: { userId: { in: existingUserIds } },
    });
    // Delete orphaned facilities created by previous seeds.
    // Facility names from our seed data are unique enough to safely target.
    const seedFacilityNames = SEED_DOCTORS.map((d) => d.facility.name);
    await prisma.facility.deleteMany({
      where: { name: { in: seedFacilityNames } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: existingUserIds } },
    });
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  for (const doctor of SEED_DOCTORS) {
    // 1. Create the user in auth.users
    const user = await prisma.user.create({
      data: {
        phoneNumber: doctor.phoneNumber,
        passwordHash,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        userType: 'doctor',
        isVerified: true,
        isActive: true,
      },
    });

    // 2. Create the doctor profile in doctors.profiles
    await prisma.doctorProfile.create({
      data: {
        userId: user.id,
        registrationNumber: doctor.registrationNumber,
        specialties: doctor.specialties,
        subSpecialties: doctor.subSpecialties,
        yearsOfExperience: doctor.yearsOfExperience,
        about: doctor.about,
        languagesSpoken: doctor.languagesSpoken,
        consultationFeeMga: doctor.consultationFeeMga,
        consultationDurationMinutes: doctor.consultationDurationMinutes,
        videoConsultationEnabled: doctor.videoConsultationEnabled,
        homeVisitEnabled: doctor.homeVisitEnabled,
        education: doctor.education,
        certifications: doctor.certifications,
        insuranceAccepted: doctor.insuranceAccepted,
        // All seeded doctors are live and searchable
        isProfileLive: true,
        // Seed with realistic-looking stats so the UI isn't empty
        averageRating: Math.floor(Math.random() * 151) + 350, // 350–500 (3.50–5.00 stars)
        totalReviews: Math.floor(Math.random() * 100) + 5,
        totalAppointments: Math.floor(Math.random() * 500) + 20,
      },
    });

    // 3. Create the facility in doctors.facilities
    const facility = await prisma.facility.create({
      data: {
        name: doctor.facility.name,
        type: doctor.facility.type,
        address: doctor.facility.address,
        city: doctor.facility.city,
        region: doctor.facility.region,
        isVerified: true,
      },
    });

    // 4. Link doctor to facility via doctors.doctor_facilities
    await prisma.doctorFacility.create({
      data: {
        doctorId: user.id,
        facilityId: facility.id,
      },
    });

    // 5. Set the PostGIS geolocation on the facility.
    // Prisma cannot write to Unsupported() columns directly, so we use $executeRawUnsafe
    // with positional parameters. The PrismaPg adapter sends tagged-template params as text,
    // but PostgreSQL's `id` column is uuid — the cast $3::uuid resolves the type mismatch.
    await prisma.$executeRawUnsafe(
      `UPDATE doctors.facilities
       SET geolocation = ST_SetSRID(ST_MakePoint($1, $2), 4326)
       WHERE id::text = $3`,
      doctor.facility.lng,
      doctor.facility.lat,
      facility.id,
    );

    console.log(`  ✓ Dr. ${doctor.firstName} ${doctor.lastName} — ${doctor.specialties.join(', ')}`);
  }

  // Also seed a few patient accounts for testing the booking flow
  const patients = [
    { firstName: 'Tahina', lastName: 'Rasoamanana', phoneNumber: '+261320000001' },
    { firstName: 'Fitia', lastName: 'Andriamahefa', phoneNumber: '+261320000002' },
    { firstName: 'Sitraka', lastName: 'Rabemanantsoa', phoneNumber: '+261320000003' },
  ];

  console.log('\nSeeding 3 test patients...\n');

  for (const patient of patients) {
    await prisma.user.create({
      data: {
        phoneNumber: patient.phoneNumber,
        passwordHash,
        firstName: patient.firstName,
        lastName: patient.lastName,
        userType: 'patient',
        isVerified: true,
        isActive: true,
      },
    });
    console.log(`  ✓ ${patient.firstName} ${patient.lastName}`);
  }

  console.log('\nSeed completed: 20 doctors + 3 patients created.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
