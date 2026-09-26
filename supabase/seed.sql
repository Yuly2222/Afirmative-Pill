-- =====================================================================
-- Afirmative Pill — dataset de 50 medicamentos (mercado colombiano, COP)
-- Ejecutar DESPUÉS de schema.sql.
-- =====================================================================

insert into laboratories (name, country) values
  ('Tecnoquímicas (MK)', 'Colombia'),
  ('Genfar', 'Colombia'),
  ('La Santé', 'Colombia'),
  ('Procaps', 'Colombia'),
  ('Bayer', 'Alemania'),
  ('Pfizer', 'Estados Unidos'),
  ('Sanofi', 'Francia'),
  ('GSK', 'Reino Unido'),
  ('Novartis', 'Suiza'),
  ('MSD', 'Estados Unidos'),
  ('AstraZeneca', 'Reino Unido'),
  ('Merck', 'Alemania'),
  ('Roche', 'Suiza'),
  ('Boehringer Ingelheim', 'Alemania'),
  ('Haleon', 'Reino Unido');

insert into therapeutic_categories (name, description) values
  ('Analgésicos y antipiréticos', 'Alivio del dolor leve a moderado y control de la fiebre.'),
  ('Antiinflamatorios no esteroideos', 'AINEs para dolor e inflamación musculoesquelética.'),
  ('Antibióticos', 'Tratamiento de infecciones bacterianas. Venta bajo fórmula médica.'),
  ('Cardiovasculares', 'Hipertensión, antiagregación, anticoagulación y control del ritmo cardiaco.'),
  ('Antidiabéticos', 'Control glucémico en diabetes mellitus tipo 2.'),
  ('Hipolipemiantes', 'Reducción de colesterol LDL y triglicéridos.'),
  ('Gastrointestinales', 'Acidez, reflujo, espasmos y diarrea.'),
  ('Antialérgicos', 'Antihistamínicos para rinitis y urticaria.'),
  ('Respiratorios', 'Asma, EPOC, tos y congestión.'),
  ('Sistema nervioso central', 'Antidepresivos, ansiolíticos y anticonvulsivantes.'),
  ('Endocrinos y corticoides', 'Hormona tiroidea y corticoesteroides sistémicos.'),
  ('Vitaminas y suplementos', 'Suplementación vitamínica y mineral.'),
  ('Dermatológicos', 'Tratamientos tópicos para piel.');

insert into medications
  (commercial_name, active_ingredient, concentration, presentation, laboratory_id, category_id,
   price, stock, requires_prescription, indications, contraindications)
select v.commercial_name, v.active_ingredient, v.concentration, v.presentation,
       l.id, c.id, v.price, v.stock, v.rx, v.indications, v.contraindications
from (values
  -- Analgésicos y antipiréticos
  ('Dolex', 'Acetaminofén', '500 mg', 'Caja x 100 tabletas', 'GSK', 'Analgésicos y antipiréticos', 18900, 250, false,
   'Dolor leve a moderado (cefalea, dolor dental, dolor muscular) y fiebre.', 'Insuficiencia hepática grave. Hipersensibilidad al acetaminofén.'),
  ('Acetaminofén MK', 'Acetaminofén', '500 mg', 'Caja x 100 tabletas', 'Tecnoquímicas (MK)', 'Analgésicos y antipiréticos', 9500, 400, false,
   'Dolor leve a moderado y fiebre.', 'Insuficiencia hepática grave. Consumo crónico de alcohol.'),
  ('Dolex Gripa', 'Acetaminofén + Fenilefrina + Clorfenamina', '500 mg / 5 mg / 2 mg', 'Caja x 12 tabletas', 'GSK', 'Analgésicos y antipiréticos', 14200, 160, false,
   'Alivio sintomático de gripa: fiebre, congestión nasal y estornudos.', 'Hipertensión no controlada, glaucoma, uso de IMAO.'),
  ('Tramadol Genfar', 'Tramadol clorhidrato', '50 mg', 'Caja x 10 cápsulas', 'Genfar', 'Analgésicos y antipiréticos', 16500, 45, true,
   'Dolor moderado a severo.', 'Epilepsia no controlada, uso de IMAO, intoxicación con alcohol u opioides.'),

  -- AINEs
  ('Advil Max', 'Ibuprofeno', '400 mg', 'Caja x 20 cápsulas blandas', 'Haleon', 'Antiinflamatorios no esteroideos', 21500, 180, false,
   'Dolor de cabeza, dolor menstrual, dolor muscular y fiebre.', 'Úlcera péptica activa, insuficiencia renal, tercer trimestre de embarazo.'),
  ('Ibuprofeno Genfar', 'Ibuprofeno', '800 mg', 'Caja x 30 tabletas', 'Genfar', 'Antiinflamatorios no esteroideos', 12800, 120, true,
   'Artritis reumatoide, osteoartritis y dolor inflamatorio.', 'Úlcera péptica, sangrado gastrointestinal, insuficiencia cardiaca grave.'),
  ('Naproxeno La Santé', 'Naproxeno sódico', '550 mg', 'Caja x 10 tabletas', 'La Santé', 'Antiinflamatorios no esteroideos', 8900, 90, false,
   'Dolor musculoesquelético, dismenorrea y cefalea.', 'Asma inducida por AINEs, úlcera péptica activa.'),
  ('Voltaren Emulgel', 'Diclofenaco dietilamina', '1 %', 'Tubo x 60 g', 'Haleon', 'Antiinflamatorios no esteroideos', 32900, 75, false,
   'Dolor e inflamación local por golpes, esguinces y dolor articular.', 'No aplicar sobre heridas abiertas. Hipersensibilidad a AINEs.'),
  ('Celebrex', 'Celecoxib', '200 mg', 'Caja x 10 cápsulas', 'Pfizer', 'Antiinflamatorios no esteroideos', 58700, 30, true,
   'Osteoartritis, artritis reumatoide y espondilitis anquilosante.', 'Cirugía de revascularización coronaria, alergia a sulfonamidas.'),

  -- Antibióticos
  ('Amoxicilina MK', 'Amoxicilina', '500 mg', 'Caja x 50 cápsulas', 'Tecnoquímicas (MK)', 'Antibióticos', 24500, 110, true,
   'Infecciones respiratorias, otitis, infecciones urinarias por gérmenes sensibles.', 'Alergia a penicilinas.'),
  ('Augmentin', 'Amoxicilina + Ácido clavulánico', '875 mg / 125 mg', 'Caja x 14 tabletas', 'GSK', 'Antibióticos', 89900, 40, true,
   'Sinusitis, neumonía adquirida en la comunidad, infecciones de piel.', 'Alergia a betalactámicos. Antecedente de ictericia por amoxicilina-clavulanato.'),
  ('Azitromicina Genfar', 'Azitromicina', '500 mg', 'Caja x 3 tabletas', 'Genfar', 'Antibióticos', 13900, 85, true,
   'Faringitis, bronquitis, infecciones de transmisión sexual por Chlamydia.', 'Hipersensibilidad a macrólidos, enfermedad hepática grave.'),
  ('Ciprofloxacina La Santé', 'Ciprofloxacina', '500 mg', 'Caja x 10 tabletas', 'La Santé', 'Antibióticos', 11200, 70, true,
   'Infecciones urinarias complicadas y gastrointestinales.', 'Menores de 18 años, embarazo, uso con tizanidina.'),
  ('Cefalexina MK', 'Cefalexina', '500 mg', 'Caja x 10 cápsulas', 'Tecnoquímicas (MK)', 'Antibióticos', 15600, 0, true,
   'Infecciones de piel, tejidos blandos y vías urinarias.', 'Alergia a cefalosporinas.'),

  -- Cardiovasculares
  ('Losartán MK', 'Losartán potásico', '50 mg', 'Caja x 30 tabletas', 'Tecnoquímicas (MK)', 'Cardiovasculares', 10500, 300, true,
   'Hipertensión arterial y nefropatía diabética.', 'Embarazo, uso con aliskireno en diabéticos.'),
  ('Enalapril Genfar', 'Enalapril maleato', '20 mg', 'Caja x 30 tabletas', 'Genfar', 'Cardiovasculares', 7900, 220, true,
   'Hipertensión e insuficiencia cardiaca.', 'Angioedema previo, embarazo.'),
  ('Amlodipino La Santé', 'Amlodipino', '5 mg', 'Caja x 30 tabletas', 'La Santé', 'Cardiovasculares', 8600, 260, true,
   'Hipertensión arterial y angina estable.', 'Shock cardiogénico, hipotensión grave.'),
  ('Betaloc Zok', 'Metoprolol succinato', '50 mg', 'Caja x 30 tabletas', 'AstraZeneca', 'Cardiovasculares', 62300, 55, true,
   'Hipertensión, angina, insuficiencia cardiaca estable.', 'Bradicardia sinusal, bloqueo AV de segundo o tercer grado.'),
  ('Aspirina Protect', 'Ácido acetilsalicílico', '100 mg', 'Caja x 28 tabletas', 'Bayer', 'Cardiovasculares', 16800, 190, false,
   'Prevención secundaria de infarto y accidente cerebrovascular.', 'Úlcera activa, hemofilia, menores de 16 años.'),
  ('Plavix', 'Clopidogrel', '75 mg', 'Caja x 28 tabletas', 'Sanofi', 'Cardiovasculares', 148500, 25, true,
   'Prevención de eventos aterotrombóticos tras infarto o stent.', 'Sangrado patológico activo, insuficiencia hepática grave.'),
  ('Warfarina Genfar', 'Warfarina sódica', '5 mg', 'Caja x 30 tabletas', 'Genfar', 'Cardiovasculares', 19800, 60, true,
   'Tromboembolismo venoso, fibrilación auricular, válvulas protésicas.', 'Embarazo, hemorragia activa, hipertensión grave no controlada.'),

  -- Antidiabéticos
  ('Metformina MK', 'Metformina clorhidrato', '850 mg', 'Caja x 30 tabletas', 'Tecnoquímicas (MK)', 'Antidiabéticos', 9800, 280, true,
   'Diabetes mellitus tipo 2.', 'Insuficiencia renal grave, acidosis metabólica.'),
  ('Glucophage XR', 'Metformina clorhidrato liberación prolongada', '500 mg', 'Caja x 30 tabletas', 'Merck', 'Antidiabéticos', 38900, 90, true,
   'Diabetes mellitus tipo 2 con mejor tolerancia gastrointestinal.', 'Insuficiencia renal grave, cetoacidosis diabética.'),
  ('Januvia', 'Sitagliptina', '100 mg', 'Caja x 28 tabletas', 'MSD', 'Antidiabéticos', 189900, 3, true,
   'Diabetes mellitus tipo 2 en monoterapia o combinación.', 'Diabetes tipo 1, antecedente de pancreatitis.'),
  ('Jardiance', 'Empagliflozina', '25 mg', 'Caja x 30 tabletas', 'Boehringer Ingelheim', 'Antidiabéticos', 214500, 18, true,
   'Diabetes tipo 2 y reducción de riesgo cardiovascular.', 'Diálisis, cetoacidosis diabética.'),

  -- Hipolipemiantes
  ('Atorvastatina Genfar', 'Atorvastatina', '20 mg', 'Caja x 30 tabletas', 'Genfar', 'Hipolipemiantes', 14900, 210, true,
   'Hipercolesterolemia y prevención cardiovascular.', 'Enfermedad hepática activa, embarazo, lactancia.'),
  ('Lipitor', 'Atorvastatina', '40 mg', 'Caja x 30 tabletas', 'Pfizer', 'Hipolipemiantes', 136800, 35, true,
   'Hipercolesterolemia primaria y dislipidemia mixta.', 'Enfermedad hepática activa, embarazo.'),
  ('Rosuvastatina Procaps', 'Rosuvastatina', '10 mg', 'Caja x 30 tabletas', 'Procaps', 'Hipolipemiantes', 24700, 150, true,
   'Hipercolesterolemia y prevención de eventos cardiovasculares.', 'Miopatía, insuficiencia renal grave.'),

  -- Gastrointestinales
  ('Omeprazol MK', 'Omeprazol', '20 mg', 'Caja x 30 cápsulas', 'Tecnoquímicas (MK)', 'Gastrointestinales', 11900, 320, false,
   'Acidez, reflujo gastroesofágico y dispepsia.', 'Uso concomitante con nelfinavir.'),
  ('Nexium', 'Esomeprazol', '40 mg', 'Caja x 14 tabletas', 'AstraZeneca', 'Gastrointestinales', 97800, 40, true,
   'Enfermedad por reflujo erosiva, erradicación de H. pylori.', 'Hipersensibilidad a benzimidazoles.'),
  ('Buscapina', 'Butilbromuro de hioscina', '10 mg', 'Caja x 20 grageas', 'Sanofi', 'Gastrointestinales', 23400, 130, false,
   'Cólicos y espasmos gastrointestinales, biliares y urinarios.', 'Glaucoma de ángulo cerrado, miastenia gravis, megacolon.'),
  ('Loperamida La Santé', 'Loperamida clorhidrato', '2 mg', 'Caja x 6 tabletas', 'La Santé', 'Gastrointestinales', 5900, 200, false,
   'Diarrea aguda no infecciosa.', 'Menores de 2 años, colitis ulcerosa aguda, diarrea con sangre.'),
  ('Alka-Seltzer', 'Bicarbonato de sodio + Ácido cítrico + Ácido acetilsalicílico', '1976 mg / 1000 mg / 324 mg', 'Caja x 12 tabletas efervescentes', 'Bayer', 'Gastrointestinales', 15800, 170, false,
   'Acidez estomacal acompañada de dolor de cabeza.', 'Úlcera péptica, dietas bajas en sodio, menores de 12 años.'),

  -- Antialérgicos
  ('Loratadina MK', 'Loratadina', '10 mg', 'Caja x 10 tabletas', 'Tecnoquímicas (MK)', 'Antialérgicos', 4900, 350, false,
   'Rinitis alérgica y urticaria crónica.', 'Hipersensibilidad a loratadina.'),
  ('Cetirizina Genfar', 'Cetirizina diclorhidrato', '10 mg', 'Caja x 10 tabletas', 'Genfar', 'Antialérgicos', 5600, 240, false,
   'Rinitis alérgica estacional y perenne, urticaria.', 'Insuficiencia renal terminal.'),
  ('Allegra', 'Fexofenadina clorhidrato', '180 mg', 'Caja x 10 tabletas', 'Sanofi', 'Antialérgicos', 42800, 80, false,
   'Rinitis alérgica y urticaria idiopática crónica.', 'Hipersensibilidad a fexofenadina.'),

  -- Respiratorios
  ('Ventolin', 'Salbutamol', '100 mcg/dosis', 'Inhalador x 200 dosis', 'GSK', 'Respiratorios', 29900, 95, true,
   'Broncoespasmo en asma y EPOC.', 'Hipersensibilidad al salbutamol.'),
  ('Singulair', 'Montelukast sódico', '10 mg', 'Caja x 30 tabletas', 'MSD', 'Respiratorios', 118600, 28, true,
   'Profilaxis del asma y rinitis alérgica.', 'Hipersensibilidad al montelukast.'),
  ('Bisolvon', 'Bromhexina clorhidrato', '8 mg / 5 ml', 'Frasco jarabe x 120 ml', 'Sanofi', 'Respiratorios', 21900, 110, false,
   'Tos con flemas en bronquitis aguda.', 'Úlcera gástrica, primer trimestre de embarazo.'),

  -- Sistema nervioso central
  ('Sertralina Genfar', 'Sertralina', '50 mg', 'Caja x 30 tabletas', 'Genfar', 'Sistema nervioso central', 17900, 120, true,
   'Depresión mayor, trastorno obsesivo compulsivo, trastorno de pánico.', 'Uso con IMAO o pimozida.'),
  ('Fluoxetina La Santé', 'Fluoxetina', '20 mg', 'Caja x 30 cápsulas', 'La Santé', 'Sistema nervioso central', 12400, 140, true,
   'Depresión, bulimia nerviosa, TOC.', 'Uso con IMAO, tioridazina o pimozida.'),
  ('Rivotril', 'Clonazepam', '2 mg', 'Caja x 30 tabletas', 'Roche', 'Sistema nervioso central', 45600, 20, true,
   'Trastorno de pánico y crisis epilépticas. Medicamento de control especial.', 'Insuficiencia respiratoria grave, glaucoma de ángulo cerrado.'),
  ('Tegretol', 'Carbamazepina', '200 mg', 'Caja x 30 tabletas', 'Novartis', 'Sistema nervioso central', 38200, 0, true,
   'Epilepsia y neuralgia del trigémino.', 'Bloqueo AV, depresión de médula ósea, uso con IMAO.'),

  -- Endocrinos y corticoides
  ('Eutirox', 'Levotiroxina sódica', '50 mcg', 'Caja x 50 tabletas', 'Merck', 'Endocrinos y corticoides', 26300, 180, true,
   'Hipotiroidismo y supresión de TSH.', 'Tirotoxicosis no tratada, infarto agudo de miocardio.'),
  ('Prednisolona Procaps', 'Prednisolona', '5 mg', 'Caja x 20 tabletas', 'Procaps', 'Endocrinos y corticoides', 9700, 100, true,
   'Procesos inflamatorios, alérgicos y autoinmunes.', 'Infecciones sistémicas no controladas, vacunas vivas.'),

  -- Vitaminas y suplementos
  ('Vitamina C MK', 'Ácido ascórbico', '500 mg', 'Frasco x 100 tabletas masticables', 'Tecnoquímicas (MK)', 'Vitaminas y suplementos', 19900, 300, false,
   'Suplemento de vitamina C.', 'Antecedente de cálculos renales de oxalato.'),
  ('Centrum Adultos', 'Multivitamínico y minerales', 'N/A', 'Frasco x 30 tabletas', 'Haleon', 'Vitaminas y suplementos', 46900, 90, false,
   'Suplemento multivitamínico diario para adultos.', 'Hipervitaminosis A o D.'),
  ('Caltrate 600 + D', 'Carbonato de calcio + Vitamina D3', '600 mg / 400 UI', 'Frasco x 60 tabletas', 'Haleon', 'Vitaminas y suplementos', 54800, 70, false,
   'Prevención y tratamiento de osteoporosis.', 'Hipercalcemia, cálculos renales de calcio.'),

  -- Dermatológicos
  ('Canesten', 'Clotrimazol', '1 %', 'Tubo crema x 20 g', 'Bayer', 'Dermatológicos', 22900, 120, false,
   'Micosis de la piel: pie de atleta, tiña, candidiasis cutánea.', 'Hipersensibilidad al clotrimazol.'),
  ('Bactroban', 'Mupirocina', '2 %', 'Tubo ungüento x 15 g', 'GSK', 'Dermatológicos', 48700, 50, true,
   'Impétigo e infecciones cutáneas bacterianas localizadas.', 'Hipersensibilidad a mupirocina.')
) as v(commercial_name, active_ingredient, concentration, presentation, lab, category,
       price, stock, rx, indications, contraindications)
join laboratories l            on l.name = v.lab
join therapeutic_categories c  on c.name = v.category;

-- Verificación rápida: debe devolver 50.
select count(*) as medicamentos_cargados from medications;
