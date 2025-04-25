import React, { useState, useMemo, useEffect } from 'react';
import { FileUp, FileDown, X, Search, ClipboardCheck , ArrowRight, Calendar,  Clock, AlertCircle, Filter, Plus, Minus, BarChart2,  Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Configuración de Supabase
const supabaseUrl = 'https://aixtoyektrlelzhyxuuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpeHRveWVrdHJsZWx6aHl4dXVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxOTcxNDIsImV4cCI6MjA1ODc3MzE0Mn0.T3dk1xfdCs0m1R9CC2lJ1VnNgJOOMwYd7crd7sPJqD8';
const supabase = createClient(supabaseUrl, supabaseKey);

// Interfaces
interface RubroSummary {
  nombre: string;
  cantidadEmpleados: number;
  totalSueldos: number;
  totalDescuentos: number;
  totalBonos: number;
  totalFinal: number;
  color: string;
}
interface BancoSummary {
  nombre: string;
  cantidadEmpleados: number;
  totalSueldos: number;
  totalDescuentos: number;
  totalBonos: number;
  totalFinal: number;
  color: string;
}

interface Empleado {
  Codigo: string;
  Nombre: string;
  Dni: string;
  Cargo: string;
  SueldoMensual: number;
  SueldoDiario: number;
  Dias: Record<string, string>;
  FechaInicio: string; // Para 'Inicio de Labores'
  NumeroCuenta: string;
  BonoFeriado: number;
  Puntuales: number;
  Tardanzas: number;
  Faltas: number;
  Descuentos: number;
  DiasExtras?: number;
  SueldoFinal: number;
  ArchivoOrigen: string;
  NombreReporte: string;
  Mes: string;
  TipoContrato: 'planilla' | 'recibos';
  Pension: 'AFP Integra' | 'AFP Profuturo' | 'AFP Prima' | 'AFP Habitat' | 'ONP' | 'ninguno' | null;
  BonoExtra: number;
  Sede: string;
  Empresa: string;
  Rubro: string;
  Banco: string;
  FaltasJustificadas?: number;
}
const obtenerIniciales = (empresa: string) => {
  if (!empresa) return '';
  return empresa
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase();
};
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#A05195'];

const AttendanceManagement: React.FC = () => {
  // Estados
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [diasDelMes, setDiasDelMes] = useState<number>(28);
  const [descuentoTardanza, setDescuentoTardanza] = useState<number>(5);
  const [archivosCargados, setArchivosCargados] = useState<string[]>([]);
  // Removed unused state variable 'archivosExcel'
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterReporte, setFilterReporte] = useState<string>('TODOS');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(10);
  const [defaultTipoPlanilla, setDefaultTipoPlanilla] = useState<'honorarios' | 'regular'>('honorarios');
  const [defaultPension, setDefaultPension] = useState<'AFP' | 'ONP'>('AFP');
  const [defaultSede, setDefaultSede] = useState<string>('Lima');
  const [activeTab, setActiveTab] = useState<'asistencias' | 'reportes' | 'tareo' | 'personal' | 'ajustes'>('asistencias');
  const [sedes] = useState<string[]>(['Lima']);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState<boolean>(false);
  useEffect(() => {
    // Cargar datos guardados al iniciar
    const savedData = localStorage.getItem('attendanceManagementData');
    if (savedData) {
      const {
        empleados: savedEmpleados,
        archivosCargados: savedArchivos,
        config: savedConfig
      } = JSON.parse(savedData);
      
      setEmpleados(savedEmpleados || []);
      setArchivosCargados(savedArchivos || []);
      if (savedConfig) {
        setDiasDelMes(savedConfig.diasDelMes || 28);
        setDescuentoTardanza(savedConfig.descuentoTardanza || 5);
        setDefaultTipoPlanilla(savedConfig.defaultTipoPlanilla || 'honorarios');
        setDefaultPension(savedConfig.defaultPension || 'AFP');
        setDefaultSede(savedConfig.defaultSede || 'Lima');
      }
    }
  }, []);

  // Guardar datos cuando cambien
  useEffect(() => {
    const dataToSave = {
      empleados,
      archivosCargados,
      config: {
        diasDelMes,
        descuentoTardanza,
        defaultTipoPlanilla,
        defaultPension,
        defaultSede
      }
    };
    localStorage.setItem('attendanceManagementData', JSON.stringify(dataToSave));
  }, [empleados, archivosCargados, diasDelMes, descuentoTardanza, defaultTipoPlanilla, defaultPension, defaultSede]);


  // Funciones
  const extraerNombreReporte = (nombreArchivo: string): string => {
    const prefix = "ReportePlanillaResumen_";
    if (nombreArchivo.startsWith(prefix)) {
      return nombreArchivo.slice(prefix.length).replace('.xlsx', '').replace('.xls', '');
    }
    return nombreArchivo;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterReporte]);

  // Memoized values
  const reportesDisponibles = useMemo(() => {
    const reportes = Array.from(new Set(empleados.map(e => e.NombreReporte)));
    return ['TODOS', ...reportes];
  }, [empleados]);

  const validateEmployee = async (dni: string, nombre: string) => {
    try {
      
      const { data: dniData, error: dniError } = await supabase
      .from('people')
      .select('dni, nombre, ocupacion, salario, sede, empresa, rubro, activo, banco, tipocontrato, pension, fechaingreso, numerocuenta') // <- Campos agregados
      .eq('dni', dni)
      .eq('activo', true)
      .single();
      if (!dniError && dniData) {
        return { isValid: true, data: dniData };
      }
  
      const { data: nameData, error: nameError } = await supabase
        .from('people')
        .select('dni, nombre, ocupacion, salario, sede, empresa, rubro, activo, banco')
        .textSearch('nombre', nombre.split(' ').join(' & '))
        .eq('activo', true)
        .single();
  
      if (!nameError && nameData) {
        return { isValid: true, data: nameData };
      }
  
      return { 
        isValid: false, 
        error: 'Empleado no registrado' 
      };
    } catch (error) {
      console.error('Error al validar empleado:', error);
      return { isValid: false, error: 'Error al conectar con la base de datos' };
    }
    
  };

  const calcularSueldoFinal = (emp: Empleado) => {
    const descuentosAsistencia = (emp.Tardanzas * descuentoTardanza) + (emp.Faltas * emp.SueldoDiario);
  
    let descuentoPension = 0;
    if (emp.TipoContrato === 'planilla') {
      if (emp.Pension === 'AFP Profuturo') {
        descuentoPension = emp.SueldoMensual * 0.0169; // 1.69%
      } else if (emp.Pension === 'AFP Prima') {
        descuentoPension = emp.SueldoMensual * 0.0160; // 1.60%
      } else if (emp.Pension === 'AFP Habitat') {
        descuentoPension = emp.SueldoMensual * 0.0147; // 1.47%
      } else if (emp.Pension === 'AFP Integra') {
        descuentoPension = emp.SueldoMensual * 0.0155; // 1.55%
      } else if (emp.Pension === 'ONP') {
        descuentoPension = emp.SueldoMensual * 0.13; // 13%
      }
    }
  
    const diasExtrasValor = (emp.DiasExtras || 0) * emp.SueldoDiario;
    const bonoExtra = emp.BonoExtra || 0;
  
    const sueldoFinal = emp.SueldoMensual - descuentosAsistencia - descuentoPension + diasExtrasValor + bonoExtra;
  
    return {
      sueldoFinal: Math.max(0, sueldoFinal),
      descuentoPension,
      descuentosAsistencia,
      diasExtrasValor,
      bonoExtra,
    };
  };

  const procesarArchivo = async (file: File, nombreArchivo: string) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsValidating(true);
      setValidationErrors({});
      
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let mes = 'SIN MES';
        for (let i = 0; i < 5; i++) {
          if (jsonData[i] && jsonData[i].join('').includes('MES DE')) {
            const mesRow = jsonData[i].join(' ');
            mes = mesRow.replace(/.*MES DE/i, '').replace(/\d+/g, '').trim();
            break;
          }
        }

        const headerRowIndex = jsonData.findIndex(row => row[0] === 'Codigo');
        if (headerRowIndex === -1) throw new Error('Formato de archivo incorrecto');

        const diasCount = jsonData[headerRowIndex]
          .filter((cell: any) => typeof cell === 'string' && cell.startsWith('Dia'))
          .length;
        setDiasDelMes(prev => Math.max(prev, diasCount));

        const nombreReporte = extraerNombreReporte(nombreArchivo);
        const nuevosEmpleados: Empleado[] = [];
        const errores: Record<string, string> = {};
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[0]) break;

          const dni = row[2]?.toString() || '';
          const nombre = row[1]?.toString() || '';

          const validation = await validateEmployee(dni, nombre);
          
          if (!validation.isValid) {
            errores[dni || `row-${i}`] = validation.error || `Empleado no validado: ${nombre}`;
            continue;
          }

          const empleadoDB = validation.data;

          const dias: Record<string, string> = {};
          let puntuales = 0;
          let tardanzas = 0;
          let faltas = 0;

          for (let d = 1; d <= diasCount; d++) {
            const diaKey = `Dia${d}`;
            const estado = row[6 + d - 1]?.toString() || 'NL';
            dias[diaKey] = estado;
            
            if (estado === 'PU') puntuales++;
            if (estado === 'TA') tardanzas++;
            if (estado === 'FA') faltas++;
          }

          const sueldoMensual = empleadoDB.salario || Number(row[4]) || 0;
          const sueldoDiario = Number(row[5]) || (sueldoMensual / diasDelMes);          const descuentosAsistencia = (tardanzas * descuentoTardanza) + (faltas * sueldoDiario);
          
          const empleado: Empleado = {
            Codigo: row[0]?.toString() || '',
            Nombre: nombre,
            Dni: dni,
            Cargo: empleadoDB.ocupacion || row[3]?.toString() || '',
            SueldoMensual: empleadoDB.salario || Number(row[4]) || 0,
            SueldoDiario: sueldoDiario,
            Dias: dias,
            Puntuales: puntuales,
            Tardanzas: tardanzas,
            Faltas: faltas,
            Descuentos: descuentosAsistencia,
            DiasExtras: 0,
            SueldoFinal: 0,
            ArchivoOrigen: nombreArchivo,
            NombreReporte: nombreReporte,
            Mes: mes,
            TipoContrato: empleadoDB?.tipocontrato || defaultTipoPlanilla, // Usa el valor de la base de datos o el valor predeterminado
            Pension: empleadoDB?.pension || (defaultTipoPlanilla === 'regular' ? defaultPension : null), // Usa el valor de la base de datos o asigna null si no aplica
            BonoExtra: 0,
            Sede: empleadoDB?.sede ?? defaultSede,
            Empresa: empleadoDB.empresa || '',
            Rubro: empleadoDB.rubro || '',
            Banco: empleadoDB.banco || 'No especificado',
            FechaInicio: empleadoDB?.fechaingreso || '', // Asegúrate de usar el valor de la base de datos
            NumeroCuenta: empleadoDB?.numerocuenta || '', // Usar numerocuenta de Supabase
          };

          const { sueldoFinal } = calcularSueldoFinal(empleado);
          empleado.SueldoFinal = sueldoFinal;

          nuevosEmpleados.push(empleado);
        }

        setEmpleados(prev => [...prev, ...nuevosEmpleados]);
        setValidationErrors(prev => ({ ...prev, ...errores }));
        setArchivosCargados(prev => [...prev, nombreArchivo]);

        if (Object.keys(errores).length > 0) {
          alert(`Se procesaron ${nuevosEmpleados.length} empleados válidos. ${Object.keys(errores).length} no pasaron validación.`);
        }
      } catch (error) {
        console.error('Error al procesar el archivo:', error);
        alert(`Error al procesar ${nombreArchivo}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      } finally {
        setIsValidating(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      procesarArchivo(files[i], files[i].name);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (nombreArchivo: string) => {
    setEmpleados(prev => prev.filter(emp => emp.ArchivoOrigen !== nombreArchivo));
    setArchivosCargados(prev => prev.filter(archivo => archivo !== nombreArchivo));
    
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach(key => {
        if (newErrors[key].includes(nombreArchivo)) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  };

  const handleDayChange = (codigo: string, dia: number, valor: string) => {
    setEmpleados(prev => prev.map(emp => {
      if (emp.Codigo === codigo) {
        const oldEstado = emp.Dias[`Dia${dia}`];
        const newDias = { ...emp.Dias, [`Dia${dia}`]: valor };
        
        let puntuales = emp.Puntuales;
        let tardanzas = emp.Tardanzas;
        let faltas = emp.Faltas;
        let diasExtras = emp.DiasExtras || 0;

        if (oldEstado === 'PU' || oldEstado === 'AS') puntuales--;
        if (oldEstado === 'TA') tardanzas--;
        if (oldEstado === 'FA') faltas--;
        if (oldEstado === 'DE') diasExtras--;

        if (valor === 'PU' || valor === 'AS') puntuales++;
        if (valor === 'TA') tardanzas++;
        if (valor === 'FA') faltas++;
        if (valor === 'DE') diasExtras++;

        const empleadoActualizado = {
          ...emp, 
          Dias: newDias,
          Puntuales: puntuales,
          Tardanzas: tardanzas,
          Faltas: faltas,
          DiasExtras: diasExtras
        };

        const { sueldoFinal, descuentosAsistencia } = calcularSueldoFinal(empleadoActualizado);
        
        return {
          ...empleadoActualizado,
          Descuentos: descuentosAsistencia,
          SueldoFinal: sueldoFinal
        };
      }
      return emp;
    }));
  };

  const handleTipoPlanillaChange = (codigo: string, tipo: 'honorarios' | 'regular') => {
    setEmpleados(prev => prev.map(emp => {
      if (emp.Codigo === codigo) {
        const empleadoActualizado = {
          ...emp,
          TipoPlanilla: tipo,
          Pension: tipo === 'honorarios' ? 'ninguno' : (defaultPension === 'AFP' ? 'AFP Integra' : 'ONP') as 'AFP Integra' | 'AFP Profuturo' | 'AFP Prima' | 'AFP Habitat' | 'ONP' | 'ninguno'
        };

        const { sueldoFinal } = calcularSueldoFinal(empleadoActualizado);
        
        return {
          ...empleadoActualizado,
          SueldoFinal: sueldoFinal
        };
      }
      return emp;
    }));
  };

  const handlePensionChange = (codigo: string, pension: 'AFP Integra' | 'AFP Profuturo' | 'AFP Prima' | 'AFP Habitat' | 'ONP') => {
    console.log(`Cambiando pensión para el empleado ${codigo} a ${pension}`);
    setEmpleados((prev) =>
      prev.map((emp) => {
        if (emp.Codigo === codigo && emp.TipoPlanilla === 'regular') {
          const empleadoActualizado = {
            ...emp,
            Pension: pension as 'AFP Integra' | 'AFP Profuturo' | 'AFP Prima' | 'AFP Habitat' | 'ONP' | 'ninguno',
          };

          const { sueldoFinal } = calcularSueldoFinal(empleadoActualizado);

          return {
            ...empleadoActualizado,
            SueldoFinal: sueldoFinal,
          };
        }
        return emp;
      })
    );
  };

  const handleBonoExtraChange = (codigo: string, bono: number) => {
    setEmpleados(prev => prev.map(emp => {
      if (emp.Codigo === codigo) {
        const empleadoActualizado = {
          ...emp,
          BonoExtra: bono
        };

        const { sueldoFinal } = calcularSueldoFinal(empleadoActualizado);
        
        return {
          ...empleadoActualizado,
          SueldoFinal: sueldoFinal
        };
      }
      return emp;
    }));
  };

  const handleExportReports = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const fecha = new Date();
      const fechaStr = fecha.toISOString().split('T')[0];
  
      // ===================== HOJA RESUMEN =====================
      const summarySheet = workbook.addWorksheet('Resumen General');
      
      // Estilo profesional para headers
      const headerStyle = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } },
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
        alignment: { vertical: 'middle', horizontal: 'center' },
        border: {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } }
        }
      };
  
      // Título principal
      summarySheet.mergeCells('A1:F1');
      summarySheet.getCell('A1').value = 'REPORTE ANALÍTICO COMPLETO';
      summarySheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F497D' } };
      summarySheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  
      // Subtítulos
      summarySheet.addRow(['Fecha de exportación:', fecha.toLocaleDateString('es-PE')]);
      summarySheet.addRow(['Total empleados:', empleadosFiltrados.length]);
      summarySheet.addRow([]);
  
      // Tabla de resumen
      const summaryHeaders = ['Rubro', 'Bancos', 'Sedes', 'Total Sueldos', 'Total Descuentos', 'Total Final'];
      summarySheet.addRow(summaryHeaders).eachCell(cell => cell.style = headerStyle);
  
      // Datos consolidados
      const maxRows = Math.max(datosPorRubro.length, datosPorBanco.length, datosPorSede.length);
      for (let i = 0; i < maxRows; i++) {
        const row = [];
        
        // Rubro
        row.push(datosPorRubro[i]?.nombre || '');
        
        // Banco
        row.push(datosPorBanco[i]?.nombre || '');
        
        // Sede
        row.push(datosPorSede[i]?.nombre || '');
        
        // Totales
        row.push(
          (datosPorRubro[i]?.totalSueldos || 0) + 
          (datosPorBanco[i]?.totalSueldos || 0) + 
          (datosPorSede[i]?.totalSueldos || 0)
        );
        
        row.push(
          (datosPorRubro[i]?.totalDescuentos || 0) + 
          (datosPorBanco[i]?.totalDescuentos || 0) + 
          (datosPorSede[i]?.totalDescuentos || 0)
        );
        
        row.push(
          (datosPorRubro[i]?.totalFinal || 0) + 
          (datosPorBanco[i]?.totalFinal || 0) + 
          (datosPorSede[i]?.totalFinal || 0)
        );
  
        summarySheet.addRow(row);
      }
  
      // Formato numérico
      ['D', 'E', 'F'].forEach(col => {
        summarySheet.getColumn(col).numFmt = '"S/"#,##0.00';
        summarySheet.getColumn(col).width = 18;
      });
  
      // ===================== HOJA RUBROS =====================
      const rubrosSheet = workbook.addWorksheet('Análisis por Rubro');
      addAnalisisSheet(rubrosSheet, datosPorRubro, 'Rubros');
  
      // ===================== HOJA BANCOS =====================
      const bancosSheet = workbook.addWorksheet('Análisis por Banco');
      addAnalisisSheet(bancosSheet, datosPorBanco, 'Bancos');
  
      // ===================== HOJA SEDES =====================
      const sedesSheet = workbook.addWorksheet('Análisis por Sede');
      addAnalisisSheet(sedesSheet, datosPorSede, 'Sedes');
  
      // ===================== HOJA DETALLE =====================
      const detalleSheet = workbook.addWorksheet('Detalle Completo');
      
      // Configurar columnas
      detalleSheet.columns = [
        { header: 'Empleado', key: 'nombre', width: 30 },
        { header: 'DNI', key: 'dni', width: 12 },
        { header: 'Sueldo Final', key: 'sueldoFinal', width: 16 },
        { header: 'Rubro', key: 'rubro', width: 20 },
        { header: 'Banco', key: 'banco', width: 20 },
        { header: 'Sede', key: 'sede', width: 15 },
        { header: 'Reporte', key: 'reporte', width: 25 }
      ];
  
      // Agregar datos
      empleadosFiltrados.forEach(emp => {
        detalleSheet.addRow({
          nombre: emp.Nombre,
          dni: emp.Dni,
          sueldoFinal: emp.SueldoFinal,
          rubro: emp.Rubro,
          banco: emp.Banco,
          sede: emp.Sede,
          reporte: emp.NombreReporte
        });
      });
  
      // Formato monetario
      detalleSheet.getColumn('sueldoFinal').numFmt = '"S/"#,##0.00';
  
      // Auto-filtros
      detalleSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: detalleSheet.columns.length }
      };
  
      // ===================== GENERAR ARCHIVO =====================
      const buffer = await workbook.xlsx.writeBuffer();
      const nombreArchivo = `Reporte_Analitico_${fechaStr}.xlsx`;
      saveAs(new Blob([buffer]), nombreArchivo);
  
    } catch (error) {
      console.error('Error al exportar reportes:', error);
      alert('Error al generar el archivo Excel. Verifica la consola para más detalles.');
    }
  };
  
  // Función auxiliar para hojas de análisis
  const addAnalisisSheet = (worksheet: ExcelJS.Worksheet, data: any[], title: string) => {
    // Título
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = `Análisis por ${title}`;
    worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF2F5496' } };
    
    // Cabeceras
    worksheet.columns = [
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Empleados', key: 'empleados', width: 12 },
      { header: 'Sueldos', key: 'sueldos', width: 16 },
      { header: 'Descuentos', key: 'descuentos', width: 16 },
      { header: 'Bonos', key: 'bonos', width: 16 },
      { header: 'Total', key: 'total', width: 16 }
    ];
  
    // Formato numérico
    [3, 4, 5, 6].forEach(col => {
      worksheet.getColumn(col).numFmt = '"S/"#,##0.00';
    });
  
    // Agregar datos
    data.forEach(item => {
      worksheet.addRow({
        nombre: item.nombre,
        empleados: item.cantidadEmpleados,
        sueldos: item.totalSueldos,
        descuentos: item.totalDescuentos,
        bonos: item.totalBonos,
        total: item.totalFinal
      });
    });
  
    // Totales
    worksheet.addRow({
      nombre: 'TOTALES',
      empleados: data.reduce((sum, item) => sum + item.cantidadEmpleados, 0),
      sueldos: data.reduce((sum, item) => sum + item.totalSueldos, 0),
      descuentos: data.reduce((sum, item) => sum + item.totalDescuentos, 0),
      bonos: data.reduce((sum, item) => sum + item.totalBonos, 0),
      total: data.reduce((sum, item) => sum + item.totalFinal, 0)
    }).eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    });
  
    // Auto-filtros
    worksheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: worksheet.columns.length }
    };
  };

  const exportarSedeYBanco = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sede y Banco');
  
    // Encabezados
    worksheet.addRow(['Sede', 'Banco', 'Total', 'Porcentaje']).eachCell(cell => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
    });
  
    // Datos
    datosPorSedeYBanco.forEach(({ sede, bancos }) => {
      bancos.forEach(({ banco, total, porcentaje }) => {
        worksheet.addRow([sede, banco, total, `${porcentaje.toFixed(2)}%`]);
      });
    });
  
    // Formato de columnas
    worksheet.columns = [
      { width: 20 },
      { width: 20 },
      { width: 15, style: { numFmt: '"S/"#,##0.00' } },
      { width: 15 },
    ];
  
    // Descargar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Resumen_Sede_Banco.xlsx');
  };

  // Filtrado de empleados
  const empleadosFiltrados = useMemo(() => {
    return empleados.filter(emp => {
      const matchesSearch = 
        emp.Codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.Nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.Dni.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.Cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.Empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.Rubro.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesReporte = filterReporte === 'TODOS' || emp.NombreReporte === filterReporte;
      
      return matchesSearch && matchesReporte;
    });
  }, [empleados, searchTerm, filterReporte]);
  const datosPorBanco = useMemo(() => {
    const bancosMap = new Map<string, BancoSummary>();
    
    empleadosFiltrados.forEach(emp => {
      const banco = emp.Banco || 'No especificado';
      
      if (!bancosMap.has(banco)) {
        bancosMap.set(banco, {
          nombre: banco,
          cantidadEmpleados: 0,
          totalSueldos: 0,
          totalDescuentos: 0,
          totalBonos: 0,
          totalFinal: 0,
          color: COLORS[bancosMap.size % COLORS.length]
        });
      }
      
      const bancoExistente = bancosMap.get(banco)!;
      bancosMap.set(banco, {
        ...bancoExistente,
        cantidadEmpleados: bancoExistente.cantidadEmpleados + 1,
        totalSueldos: bancoExistente.totalSueldos + emp.SueldoMensual,
        totalDescuentos: bancoExistente.totalDescuentos + emp.Descuentos,
        totalBonos: bancoExistente.totalBonos + (emp.BonoExtra || 0),
        totalFinal: bancoExistente.totalFinal + emp.SueldoFinal
      });
    });
    
    return Array.from(bancosMap.values()).sort((a, b) => 
      b.totalFinal - a.totalFinal
    );
  }, [empleadosFiltrados]);
  // Datos por rubro
  const datosPorRubro = useMemo(() => {
    const rubrosMap = new Map<string, RubroSummary>();
    
    empleadosFiltrados.forEach(emp => {
      const rubro = emp.Rubro || 'Sin Rubro';
      
      if (!rubrosMap.has(rubro)) {
        rubrosMap.set(rubro, {
          nombre: rubro,
          cantidadEmpleados: 0,
          totalSueldos: 0,
          totalDescuentos: 0,
          totalBonos: 0,
          totalFinal: 0,
          color: COLORS[rubrosMap.size % COLORS.length]
        });
      }
      
      const rubroExistente = rubrosMap.get(rubro)!;
      rubrosMap.set(rubro, {
        ...rubroExistente,
        cantidadEmpleados: rubroExistente.cantidadEmpleados + 1,
        totalSueldos: rubroExistente.totalSueldos + emp.SueldoMensual,
        totalDescuentos: rubroExistente.totalDescuentos + emp.Descuentos,
        totalBonos: rubroExistente.totalBonos + (emp.BonoExtra || 0),
        totalFinal: rubroExistente.totalFinal + emp.SueldoFinal
      });
    });
    
    return Array.from(rubrosMap.values()).sort((a, b) => 
      b.totalFinal - a.totalFinal
    );
  }, [empleadosFiltrados]);

  const datosPorSede = useMemo(() => {
    const sedesMap = new Map<string, {
      nombre: string;
      cantidadEmpleados: number;
      totalSueldos: number;
      totalDescuentos: number;
      totalBonos: number;
      totalFinal: number;
      color: string;
    }>();
  
    empleadosFiltrados.forEach(emp => {
      const sede = emp.Sede || 'No especificado';
      
      if (!sedesMap.has(sede)) {
        sedesMap.set(sede, {
          nombre: sede,
          cantidadEmpleados: 0,
          totalSueldos: 0,
          totalDescuentos: 0,
          totalBonos: 0,
          totalFinal: 0,
          color: COLORS[sedesMap.size % COLORS.length]
        });
      }
      
      const sedeExistente = sedesMap.get(sede)!;
      sedesMap.set(sede, {
        ...sedeExistente,
        cantidadEmpleados: sedeExistente.cantidadEmpleados + 1,
        totalSueldos: sedeExistente.totalSueldos + emp.SueldoMensual,
        totalDescuentos: sedeExistente.totalDescuentos + emp.Descuentos,
        totalBonos: sedeExistente.totalBonos + (emp.BonoExtra || 0),
        totalFinal: sedeExistente.totalFinal + emp.SueldoFinal
      });
    });
    
    return Array.from(sedesMap.values()).sort((a, b) => 
      b.totalFinal - a.totalFinal
    );
  }, [empleadosFiltrados]);

  const datosPorSedeYBanco = useMemo(() => {
    const sedesBancosMap = new Map<string, { [banco: string]: { total: number; porcentaje: number } }>();
  
    empleadosFiltrados.forEach(emp => {
      const sede = emp.Sede || 'No especificado';
      const banco = emp.Banco || 'No especificado';
  
      if (!sedesBancosMap.has(sede)) {
        sedesBancosMap.set(sede, {});
      }
  
      const bancos = sedesBancosMap.get(sede)!;
  
      if (!bancos[banco]) {
        bancos[banco] = { total: 0, porcentaje: 0 };
      }
  
      bancos[banco].total += emp.SueldoFinal;
    });
  
    // Calcular porcentajes
    sedesBancosMap.forEach((bancos, sede) => {
      const totalSede = Object.values(bancos).reduce((sum, banco) => sum + banco.total, 0);
      Object.keys(bancos).forEach(banco => {
        bancos[banco].porcentaje = (bancos[banco].total / totalSede) * 100;
      });
    });
  
    return Array.from(sedesBancosMap.entries()).map(([sede, bancos]) => ({
      sede,
      bancos: Object.entries(bancos).map(([banco, { total, porcentaje }]) => ({
        banco,
        total,
        porcentaje,
      })),
    }));
  }, [empleadosFiltrados]);

  // Datos por ocupación
  // Removed unused 'datosPorOcupacion' variable

  // Paginación
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = empleadosFiltrados.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(empleadosFiltrados.length / recordsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Datos por reporte
  const datosPorReporte = useMemo(() => {
    const reportesUnicos = Array.from(new Set(empleadosFiltrados.map(e => e.NombreReporte)));
    
    return reportesUnicos.map(reporte => {
      const empleadosReporte = empleadosFiltrados.filter(e => e.NombreReporte === reporte);
      const totalSueldos = empleadosReporte.reduce((sum, emp) => sum + emp.SueldoFinal, 0);
      
      return {
        name: reporte,
        value: totalSueldos,
        empleados: empleadosReporte.length,
        color: COLORS[reportesUnicos.indexOf(reporte) % COLORS.length]
      };
    });
  }, [empleadosFiltrados]);

  const datosFiltradosPorReporte = useMemo(() => {
    if (filterReporte === 'TODOS') return datosPorReporte;
    return datosPorReporte.filter(item => item.name === filterReporte);
  }, [datosPorReporte, filterReporte]);

  const handleExport = () => {
    // Asume que estos arrays/vars están en tu scope:
    // empleados, empleadosFiltrados, diasDelMes, descuentoTardanza
  
    const archivosOrigen = Array.from(new Set(empleados.map(e => e.ArchivoOrigen)));
    const reportes = Array.from(new Set(empleados.map(e => e.NombreReporte))).join(', ');
    const fechaExport = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long' });
  
    // Colores
    const puntualColor = { argb: '00B050' };   // Verde
    const tardanzaColor = { argb: 'FFA500' };  // Rojo
    const faltasColor = { argb: 'FF0000' };    // Naranja
  
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Planilla de Asistencias');
  
    // — Título —
    ws.mergeCells('A1:Y1');
    ws.getCell('A1').value = 'PLANILLA DE ASISTENCIAS';
    ws.getCell('A1').font = { bold: true, size: 16, color: { argb: '1F497D' } };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.getColumn(10).numFmt = 'dd/mm/yyyy'; // Aplica formato de fecha a la columna 10
  
    // — Información previa —
    ws.addRow(['Fuente:', archivosOrigen.join(', ')]);
    ws.addRow(['Reportes:', reportes]);
    ws.addRow(['Descuento Tardanza:', `S/${descuentoTardanza.toFixed(2)}`]);
    ws.addRow([]);
  
    // — Encabezados —
    const headers = [
      'Código', 'Empleado', 'DNI', 'Cargo', 'Sede', 'Planilla', 'Pensión',
      'Sueldo Mensual', 'Sueldo Diario',
      ...Array.from({ length: diasDelMes }, (_, i) => `D${i + 1}`),
      'Puntual', 'Tardanza', 'Faltas', 'Descuentos', 'Bono Extra', 'Sueldo Final', 'Reporte', 'Archivo'
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  
    // — Filas de datos —
    empleadosFiltrados.forEach(emp => {
      // Construir array de valores primitivos (strings o numbers)
      const data = [
        emp.Codigo,
        emp.Nombre,
        emp.Dni,
        emp.Cargo,
        emp.Sede,
        emp.TipoContrato === 'planilla' ? 'Planilla' : 'Honorarios',
        emp.Pension || 'N/A',
        Number(emp.SueldoMensual.toFixed(2)),
        Number(emp.SueldoDiario.toFixed(2)),
        emp.FechaInicio || 'N/A', // Incluye FechaInicio en la exportación
        ...Array.from({ length: diasDelMes }, (_, i) => emp.Dias?.[`Dia${i + 1}`] || 'NL'),
        emp.Puntuales,
        emp.Tardanzas,
        emp.Faltas,
        Number(emp.Descuentos.toFixed(2)),
        Number(emp.BonoExtra.toFixed(2)),
        Number(emp.SueldoFinal.toFixed(2)),
        emp.NombreReporte,
        emp.ArchivoOrigen
      ];
  
      const row = ws.addRow(data);
  
      // Índices de las columnas Puntual/Tardanza/Faltas (1-based)
      const base = 9 + diasDelMes;            // última columna de día
      const idxP = base + 1;                  // Puntual
      const idxT = base + 2;                  // Tardanza
      const idxF = base + 3;                  // Faltas
  
      // Aplicar color y alineación
      row.getCell(idxP).font = { color: puntualColor };
      row.getCell(idxP).alignment = { horizontal: 'center' };
  
      row.getCell(idxT).font = { color: tardanzaColor };
      row.getCell(idxT).alignment = { horizontal: 'center' };
  
      row.getCell(idxF).font = { color: faltasColor };
      row.getCell(idxF).alignment = { horizontal: 'center' };
    });
  
    // — Pie de página —
    ws.addRow([]);
    const footerRow = ws.addRow([`Exportado: ${new Date().toLocaleString()}`]);
    footerRow.eachCell(cell => {
      cell.font = { italic: true, color: { argb: '7F7F7F' } };
    });
  
    // — Columnas —
    ws.columns = [
      { width: 8 }, { width: 25 }, { width: 10 }, { width: 20 }, { width: 10 },
      { width: 12 }, { width: 10 }, { width: 15 }, { width: 15 },
      ...Array(diasDelMes).fill({ width: 4 }),
      { width: 8 }, { width: 8 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 12 },
      { width: 15 }, { width: 30 }
    ];
  
    const wsSum = workbook.addWorksheet('Resumen de Pagos');

    // Encabezado principal
    wsSum.mergeCells('A1:M1');
    wsSum.getCell('A1').value = 'RESUMEN DE PAGOS';
    wsSum.getCell('A1').font = { bold: true, size: 16, color: { argb: '1F497D' } };
    wsSum.getCell('A1').alignment = { horizontal: 'center' };
  
    // Encabezados
    const sumHeaders = [
      'NOMBRES Y APELLIDOS',
      'COD. EMPRESA - SEDE',
      'CARGO',
      'INICIO LABORES',
      'SUELDO FIJO',
      'BONO FIJO VARIABLE',
      'N° FALTAS (DESCUENTO)',
      'N° TARDANZAS (DESCUENTO)',
      'DESC. PLANILLA',
      'NETO A PAGAR (S/.)',
      'BANCO',
      'N° CUENTA',
      'CONDICIÓN'
    ];
    const sumHeaderRow = wsSum.addRow(sumHeaders);
    sumHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  
    // Filas de datos
    empleadosFiltrados.forEach(emp => {
      wsSum.addRow([
        emp.Nombre,
        `${obtenerIniciales(emp.Empresa)} - ${emp.Sede}`,
        emp.Cargo,
        emp.FechaInicio || 'N/A',  // Mostrar 'N/A' si no hay fecha
        emp.SueldoMensual,
        emp.BonoExtra || 0,
        emp.Faltas > 0 ? `${emp.Faltas} (-S/.${(emp.Faltas * emp.SueldoDiario).toFixed(2)})` : emp.Faltas,
        emp.Tardanzas > 0 ? `${emp.Tardanzas} (-S/.${(emp.Tardanzas * descuentoTardanza).toFixed(2)})` : emp.Tardanzas,
        calcularDescuentoPlanilla(emp),
        emp.SueldoFinal.toFixed(2),
        emp.Banco,
        emp.NumeroCuenta || '',
        'Falta'  // Mostrar siempre "Falta" en esta columna
      ]);
    });
  
    // Ajustar anchos de columnas
    wsSum.columns = [
      { width: 25 },  // Nombres
      { width: 20 },  // Código Empresa-Sede
      { width: 20 },  // Cargo
      { width: 15 },  // Inicio Labores
      { width: 15 },  // Sueldo Fijo
      { width: 18 },  // Bono Fijo
      { width: 18 },  // Faltas
      { width: 18 },  // Tardanzas
      { width: 18 },  // Desc. Planilla
      { width: 15 },  // Neto
      { width: 15 },  // Banco
      { width: 15 },  // N° Cuenta
      { width: 12 }   // Condición
    ];
  
    // Formato numérico para columnas monetarias
    [5, 6, 9, 10].forEach(colIndex => {
      wsSum.getColumn(colIndex).numFmt = '"S/"#,##0.00';
    });
  
    // Descargar archivo
    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Resumen_Pagos_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };
  
  // Función auxiliar para calcular descuentos de planilla
  const calcularDescuentoPlanilla = (emp: Empleado) => {
    if (!emp.Pension) return 'S/.0.00';
  
    const porcentajes = {
      'AFP Integra': 0.0155,
      'AFP Profuturo': 0.0169,
      'AFP Prima': 0.0160,
      'AFP Habitat': 0.0147,
      'ONP': 0.13
    };
  
    const descuento = emp.SueldoMensual * (porcentajes[emp.Pension] || 0);
    return `S/.${descuento.toFixed(2)} (${emp.Pension})`;
  };
  

  const leyendaEstados = [
    { codigo: 'PU', significado: 'Puntual', color: 'bg-green-100 text-green-800 border-green-200' },
    { codigo: 'TA', significado: `Tardanza (-S/.${descuentoTardanza.toFixed(2)})`, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { codigo: 'FA', significado: 'Falta (-1 día de sueldo)', color: 'bg-red-100 text-red-800 border-red-200' },
    { codigo: 'NL', significado: 'No Laborable', color: 'bg-gray-100 text-gray-800 border-gray-200' },
    { codigo: 'AS', significado: 'Asistió', color: 'bg-green-200 text-green-800 border-green-300' },
    { codigo: 'DM', significado: 'Descanso Médico', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    { codigo: 'PE', significado: 'Permiso', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { codigo: 'VA', significado: 'Vacaciones', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    { codigo: 'DE', significado: 'Día Extra', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    { codigo: 'JU', significado: 'Justificado', color: 'bg-lime-100 text-lime-800 border-lime-200' }
  ];

  const buttonStyle = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium";
  const primaryButtonStyle = `${buttonStyle} bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg`;
  const successButtonStyle = `${buttonStyle} bg-green-600 text-white hover:bg-green-700 shadow-md`;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-xl hidden md:block border-r border-gray-100">        
      <div className="p-4 flex items-center justify-center border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">          
        <div className="flex items-center gap-2">
            <Calendar className="text-white-600" size={28} />
            <h1 className="text-xl font-bold text-white">Dashbord Reportes</h1>          </div>
        </div>
        <nav className="p-4 space-y-1">
          <button
            onClick={() => setActiveTab('asistencias')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'asistencias' 
                ? 'bg-blue-100 text-blue-600 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users size={20} />
            <span>Asistencias</span>
          </button>
          <button
            onClick={() => setActiveTab('reportes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'reportes' 
                ? 'bg-blue-100 text-blue-600 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ClipboardCheck size={20} />
            <span>Reportes</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-100">
          <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {activeTab === 'asistencias' ? 'Gestión de Asistencias' : 'Dashboard Analítico'}
            </h2>
            <div className="w-full md:w-auto flex items-center gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="text-gray-400" size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar empleados..."
                  className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </header>


        {/* Content */}
        <main className="p-3 bg-gray-50">
        {Object.keys(validationErrors).length > 0 && (
  <div className="fixed right-6 top-6 z-50 w-80 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-lg">
    <div className="flex items-start">
      <div className="flex-shrink-0">
        <AlertCircle className="h-5 w-5 text-red-400" />
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">
          Empleados no registrados o inactivos en la base de datos ({Object.keys(validationErrors).length})
        </h3>
        <div className="mt-2 text-sm text-red-700">
          <ul className="list-disc pl-5 space-y-1 max-h-60 overflow-y-auto">
            {Object.entries(validationErrors).map(([key, error]) => (
              <li key={key} className="truncate">
                <span className="font-medium">{key}</span>: {error}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-2">
          <button
            onClick={() => setValidationErrors({})}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
)}

          {isValidating && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <div className="flex items-center justify-center gap-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Validando empleados</h3>
                    <p className="text-gray-500">Consultando la base de datos...</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'asistencias' ? (
            <>
              {/* Panel de configuración */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Reducir a 3 columnas */}
</div>

{/* Agregar advertencia */}
<div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
  <p>⚠️ El tipo de planilla y pensión ahora se obtienen desde la base de datos</p>
</div>

              {/* Panel de control */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
                <div className="bg-gradient-to-r from-green-600 to-green-800 p-4 text-white">
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">Planilla Consolidada</h2>
                      <p className="text-blue-100">
                        {empleados.length > 0 
                          ? `${empleados.length} empleados registrados` 
                          : 'No hay datos cargados'}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                      <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="text-blue-200" size={18} />
                          <span className="font-medium">Tardanza:</span>
                          <span>- S/.{descuentoTardanza.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="text-blue-200" size={18} />
                          <span className="font-medium">Falta:</span>
                          <span>1 día de sueldo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex flex-wrap justify-between gap-6 mb-6">
                    <div className="flex-1 min-w-[300px] space-y-4">
                      <div className="flex flex-wrap gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="text-gray-400" size={18} />
                          </div>
                          <select
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                            value={filterReporte}
                            onChange={(e) => setFilterReporte(e.target.value)}
                          >
                            {reportesDisponibles.map((reporte, index) => (
                              <option key={index} value={reporte}>
                                {reporte === 'TODOS' ? 'Todos los reportes' : reporte}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex-1 min-w-[200px]">
                          <select
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={recordsPerPage}
                            onChange={(e) => {
                              setRecordsPerPage(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                          >
                            <option value="5">5 registros/página</option>
                            <option value="10">10 registros/página</option>
                            <option value="20">20 registros/página</option>
                            <option value="30">30 registros/página</option>
                            <option value="50">50 registros/página</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-4">
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleImport}
                          className="hidden"
                          id="attendance-import"
                          multiple
                        />
                        <label
                          htmlFor="attendance-import"
                          className={`${primaryButtonStyle} min-w-[100px]`}
                        >
                          <FileUp size={20} /> Importar Excel
                        </label>
                        <button
                          onClick={handleExport}
                          className={`${successButtonStyle} ${empleados.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={empleados.length === 0}
                        >
                          <FileDown size={20} /> Exportar Excel
                        </button>
                        
                        <button
                          onClick={handleExportReports}
                          className={`${successButtonStyle} ${empleados.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={empleados.length === 0}
                        >
                          <FileDown size={20} /> Exportar Reportes
                        </button>
                          <button
                            onClick={exportarSedeYBanco}
                            className={`${successButtonStyle}`}
                          >
                            <FileDown size={20} /> Exportar Sede y Banco
                          </button>
                      </div>

                      {archivosCargados.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium flex items-center gap-2 text-sm">
                              <FileUp size={16} />
                              Archivos cargados ({archivosCargados.length})
                            </h4>
                            <span className="text-xs text-gray-500">
                              {empleados.length} registros
                            </span>
                          </div>
                          <div className="max-h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                            {archivosCargados.map((archivo, index) => {
                              const nombreReporte = extraerNombreReporte(archivo);
                              const reportIndex = reportesDisponibles.slice(1).indexOf(nombreReporte);
                              const color = COLORS[reportIndex % COLORS.length];
                              
                              return (
                                <div 
                                  key={index} 
                                  className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-100 rounded text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: color }}
                                    />
                                    <div className="truncate">
                                      <p className="font-medium truncate">{archivo}</p>
                                      <p className="text-gray-500 truncate text-xxs">Reporte: {nombreReporte}</p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveFile(archivo)}
                                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 ml-2"
                                    title="Eliminar archivo"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="text-blue-600">Leyenda de Estados</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {leyendaEstados.map((item) => (
                        <div 
                          key={item.codigo} 
                          className={`px-3 py-2 rounded-lg flex items-center gap-2 ${item.color} border`}
                        >
                          <span className="font-bold">{item.codigo}</span>
                          <span className="text-sm">{item.significado}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              
              

              {empleadosFiltrados.length > 0 ? (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="relative">
                    <div className="md:hidden text-center py-2 bg-blue-50 text-sm">
                      <div className="inline-flex items-center text-blue-600">
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Desliza horizontalmente para ver más días
                      </div>
                    </div>

                    <div 
                      className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
                      style={{ maxHeight: 'calc(100vh - 400px)' }}
                    >
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0 z-20">
                          <tr>
                            <th className="sticky left-0 z-30 bg-gray-100 p-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[80px]">Código</th>
                            <th className="sticky left-20 z-30 bg-gray-100 p-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[180px]">Empleado</th>
                            <th className="sticky left-48 z-30 bg-gray-100 p-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[100px]">DNI</th>
                            <th className="p-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[100px]">S. Mensual</th>
                            <th className="p-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[90px]">S. Diario</th>
                            
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[100px] bg-purple-50">Tipo Contrato</th>
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[90px] bg-indigo-50">Pensión</th>
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[110px] bg-green-50">Bono Extra</th>
                            
                            {Array.from({length: diasDelMes}, (_, i) => (
                              <th 
                                key={`dia-${i}`}
                                className="p-2 text-center font-semibold text-gray-700 whitespace-nowrap bg-blue-50 min-w-[50px]"
                              >
                                Día {i + 1}
                              </th>
                            ))}
                            
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[70px] bg-green-50">Punt.</th>
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[70px] bg-yellow-50">Tard.</th>
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[70px] bg-red-50">Faltas</th>
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[90px] bg-orange-50">Desctos.</th>
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[100px] bg-blue-100">Total</th>
                            <th className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[120px] bg-gray-100">Reporte</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {currentRecords.map((emp, empIndex) => (
                            <tr 
                              key={`${emp.Codigo}-${empIndex}`} 
                              className="group relative hover:bg-blue-50 even:bg-gray-50/30 transition-colors duration-150"
                            >
                              <td className="sticky left-0 z-20 bg-white group-hover:bg-blue-50 p-3 font-mono text-left border-r border-gray-200">
                                {emp.Codigo}
                              </td>
                              
                              <td className="sticky left-20 z-20 bg-white group-hover:bg-blue-50 p-3 border-r border-gray-200">
                                <div className="font-medium">{emp.Nombre}</div>
                                <div className="text-gray-500 text-xs">{emp.Cargo}</div>
                              </td>
                              
                              <td className="sticky left-48 z-20 bg-white group-hover:bg-blue-50 p-3 font-mono text-right border-r border-gray-200">
                                {emp.Dni}
                              </td>

                              <td className="p-3 font-mono text-right group-hover:bg-blue-50/50">
                                S/.{emp.SueldoMensual.toFixed(2)}
                              </td>
                              
                              <td className="p-3 font-mono text-right group-hover:bg-blue-50/50">
                                S/.{emp.SueldoDiario.toFixed(2)}
                              </td>
                              
                              <td className="p-3 text-center bg-purple-50 group-hover:bg-blue-50/50">
                                {emp.TipoContrato === 'planilla' ? 'Planilla' : 'Recibos por Honorarios'}
                              </td>
                              
                              <td className="p-3 text-center bg-indigo-50 group-hover:bg-blue-50/50">
                                {emp.TipoContrato === 'planilla' ? (emp.Pension || 'Sin Pensión') : 'N/A'}
                              </td>
                              
                              <td className="p-3 text-center bg-green-50 group-hover:bg-blue-50/50">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleBonoExtraChange(emp.Codigo, Math.max(0, (emp.BonoExtra || 0) - 50))}
                                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded group-hover:bg-blue-100"
                                  >
                                    <Minus size={16} />
                                  </button>
                                  <input
                                    type="number"
                                    value={emp.BonoExtra || 0}
                                    onChange={(e) => handleBonoExtraChange(emp.Codigo, Number(e.target.value))}
                                    className="w-20 p-1 text-sm text-center border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 group-hover:border-blue-300"
                                    min="0"
                                    step="50"
                                  />
                                  <button
                                    onClick={() => handleBonoExtraChange(emp.Codigo, (emp.BonoExtra || 0) + 50)}
                                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded group-hover:bg-blue-100"
                                  >
                                    <Plus size={16} />
                                  </button>
                                </div>
                              </td>
                              
                              {Array.from({length: diasDelMes}, (_, i) => {
                                const estado = emp.Dias[`Dia${i + 1}`] || 'NL';
                                const estadoConfig = leyendaEstados.find(e => e.codigo === estado);
                                return (
                                  <td key={i} className="p-2 text-center group-hover:bg-blue-50/50">
                                    <select
                                      value={estado}
                                      onChange={(e) => handleDayChange(emp.Codigo, i + 1, e.target.value)}
                                      className={`w-full p-2 text-sm text-center rounded border focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                                        estadoConfig?.color || 'bg-gray-50'
                                      }`}
                                    >
                                      {leyendaEstados.map(item => (
                                        <option key={item.codigo} value={item.codigo}>{item.codigo}</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              })}
                              
                              <td className="p-3 text-center bg-green-50 text-green-800 font-medium group-hover:bg-blue-50/50">
                                {emp.Puntuales}
                              </td>
                              <td className="p-3 text-center bg-yellow-50 text-yellow-800 font-medium group-hover:bg-blue-50/50">
                                {emp.Tardanzas}
                              </td>
                              <td className="p-3 text-center bg-red-50 text-red-800 font-medium group-hover:bg-blue-50/50">
                                {emp.Faltas}
                              </td>
                              <td className="p-3 text-center bg-orange-50 text-orange-800 font-mono group-hover:bg-blue-50/50">
                                S/.{emp.Descuentos.toFixed(2)}
                              </td>
                              <td className="p-3 text-center bg-blue-100 text-blue-900 font-mono font-bold group-hover:bg-blue-200">
                                S/.{emp.SueldoFinal.toFixed(2)}
                              </td>
                              <td className="p-3 text-center bg-gray-100 group-hover:bg-blue-50/50">
                                <span className="inline-block max-w-[120px] truncate">
                                  {emp.NombreReporte}
                                </span>
                              </td>
                              
                              <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-200 pointer-events-none" />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  

                  <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50">
                    <div className="text-sm text-gray-600">
                      Mostrando {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, empleadosFiltrados.length)} de {empleadosFiltrados.length} registros
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => paginate(1)}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                      >
                        «
                      </button>
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                      >
                        ‹
                      </button>
                      
                      {(() => {
                        const pages = [];
                        const maxVisiblePages = 5;
                        
                        if (totalPages <= maxVisiblePages) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          const leftOffset = Math.floor(maxVisiblePages / 2);
                          const rightOffset = Math.ceil(maxVisiblePages / 2) - 1;
                          
                          let startPage = currentPage - leftOffset;
                          let endPage = currentPage + rightOffset;
                          
                          if (startPage < 1) {
                            startPage = 1;
                            endPage = maxVisiblePages;
                          }
                          
                          if (endPage > totalPages) {
                            endPage = totalPages;
                            startPage = totalPages - maxVisiblePages + 1;
                          }
                          
                          if (startPage > 1) pages.push(1, '...');
                          for (let i = startPage; i <= endPage; i++) pages.push(i);
                          if (endPage < totalPages) pages.push('...', totalPages);
                        }
                        
                        return pages.map((page, index) => (
                          <button
                            key={index}
                            onClick={() => typeof page === 'number' ? paginate(page) : null}
                            disabled={page === '...'}
                            className={`min-w-[36px] p-2 rounded-md ${
                              page === currentPage 
                                ? 'bg-blue-600 text-white' 
                                : page === '...' 
                                  ? 'bg-transparent cursor-default' 
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        ));
                      })()}
                      
                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                      >
                        ›
                      </button>
                      <button
                        onClick={() => paginate(totalPages)}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                      >
                        »
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden py-12 text-center">
                  <div className="max-w-md mx-auto">
                    {empleados.length > 0 ? (
                      <>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                          <Search className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron resultados</h3>
                        <p className="text-gray-500 mb-6">
                          No hay coincidencias para tu búsqueda. Intenta con otros términos.
                        </p>
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setFilterReporte('TODOS');
                          }}
                          className={`${primaryButtonStyle} inline-flex`}
                        >
                          Limpiar filtros
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                          <FileUp className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos cargados</h3>
                        <p className="text-gray-500 mb-6">
                          Importa archivos Excel para comenzar a gestionar las asistencias.
                        </p>
                        <label
                          htmlFor="attendance-import"
                          className={`${primaryButtonStyle} inline-flex`}
                        >
                          <FileUp size={18} /> Importar archivos Excel
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {/* Filtro para reportes */}
              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Filter className="text-blue-500" size={20} />
                    Filtros de Reportes
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Seleccionar Reporte
                      </label>
                      <select
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={filterReporte}
                        onChange={(e) => setFilterReporte(e.target.value)}
                      >
                        {reportesDisponibles.map((reporte, index) => (
                          <option key={index} value={reporte}>
                            {reporte === 'TODOS' ? 'Todos los reportes' : reporte}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>   
              
              {/* Gráfico de barras por reporte */}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <BarChart2 className="text-green-500" size={20} />
                    Distribución por Reporte
                  </h3>
                  <div className="text-sm text-gray-500">
                    Total: S/.{datosPorReporte.reduce((sum, item) => sum + item.value, 0).toFixed(2)}
                  </div>
                </div>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={datosFiltradosPorReporte}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [`S/.${Number(value).toFixed(2)}`, 'Total']}
                      />
                      <Legend />
                      <Bar dataKey="value" name="Total Sueldo">
                        {datosFiltradosPorReporte.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

{/* Resumen por Banco con Gráfico Circular */}
<div className="bg-white p-6 rounded-xl shadow-md">
  <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
    <BarChart2 className="text-orange-500" size={20} />
    Resumen por Banco
  </h3>
  
  <div className="flex flex-col lg:flex-row gap-6">
    {/* Gráfico Circular */}
    <div className="lg:w-1/2 h-96">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datosPorBanco}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={120}
            fill="#FF8800"
            dataKey="totalFinal"
            nameKey="nombre"
            label={({ nombre, percent }) => `${nombre}: ${(percent * 100).toFixed(0)}%`}
          >
            {datosPorBanco.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => [`S/.${Number(value).toFixed(2)}`, 'Total']}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
    
    {/* Datos de Bancos */}
    <div className="lg:w-1/2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datosPorBanco.map((banco) => (
          <div key={banco.nombre} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <div 
              className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"
              style={{ backgroundColor: `${banco.color}20`, borderColor: banco.color }}
            >
              <h4 className="font-medium text-gray-800 flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: banco.color }}
                />
                <span className="truncate">{banco.nombre}</span>
              </h4>
              <span className="text-xs font-mono bg-white px-2 py-1 rounded">
                {banco.cantidadEmpleados} {banco.cantidadEmpleados === 1 ? 'empleado' : 'empleados'}
              </span>
            </div>
            
            <div className="px-4 py-2 space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Sueldos:</span>
                <span className="font-mono text-green-600">
                  S/.{banco.totalSueldos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Descuentos:</span>
                <span className="font-mono text-red-500">
                  S/.{banco.totalDescuentos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Bonos:</span>
                <span className="font-mono text-blue-500">
                  S/.{banco.totalBonos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm font-medium pt-1 mt-1 border-t border-gray-100">
                <span className="text-gray-700">Total:</span>
                <span className="font-mono text-purple-600">
                  S/.{banco.totalFinal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-700">Total General:</span>
          <span className="font-mono font-bold text-lg text-blue-600">
            S/.{datosPorBanco.reduce((sum, item) => sum + item.totalFinal, 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  </div>
</div>

              {/* Resumen por Rubro con Gráfico Circular */}
<div className="bg-white p-6 rounded-xl shadow-md">
  <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
    <BarChart2 className="text-purple-500" size={20} />
    Resumen por Rubro
  </h3>
  
  <div className="flex flex-col lg:flex-row gap-6">
    {/* Gráfico Circular */}
    <div className="lg:w-1/2 h-96">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datosPorRubro}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={120}
            fill="#8884D8"
            dataKey="totalFinal"
            nameKey="nombre"
            label={({ nombre, percent }) => `${nombre}: ${(percent * 100).toFixed(0)}%`}
          >
            {datosPorRubro.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => [`S/.${Number(value).toFixed(2)}`, 'Total']}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
    
    {/* Datos de Rubros */}
    <div className="lg:w-1/2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datosPorRubro.map((rubro) => (
          <div key={rubro.nombre} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <div 
              className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"
              style={{ backgroundColor: `${rubro.color}20`, borderColor: rubro.color }}
            >
              <h4 className="font-medium text-gray-800 flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: rubro.color }}
                />
                <span className="truncate">{rubro.nombre}</span>
              </h4>
              <span className="text-xs font-mono bg-white px-2 py-1 rounded">
                {rubro.cantidadEmpleados} {rubro.cantidadEmpleados === 1 ? 'empleado' : 'empleados'}
              </span>
            </div>
            
            <div className="px-4 py-2 space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Sueldos:</span>
                <span className="font-mono text-green-600">
                  S/.{rubro.totalSueldos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Descuentos:</span>
                <span className="font-mono text-red-500">
                  S/.{rubro.totalDescuentos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Bonos:</span>
                <span className="font-mono text-blue-500">
                  S/.{rubro.totalBonos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm font-medium pt-1 mt-1 border-t border-gray-100">
                <span className="text-gray-700">Total:</span>
                <span className="font-mono text-purple-600">
                  S/.{rubro.totalFinal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-700">Total General:</span>
          <span className="font-mono font-bold text-lg text-purple-600">
            S/.{datosPorRubro.reduce((sum, item) => sum + item.totalFinal, 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  </div>
</div>

{/* Resumen por Sede */}
<div className="bg-white p-6 rounded-xl shadow-md">
  <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
    <BarChart2 className="text-teal-500" size={20} />
    Resumen por Sede
  </h3>
  
  <div className="flex flex-col lg:flex-row gap-6">
    {/* Gráfico Circular */}
    <div className="lg:w-1/2 h-96">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datosPorSede}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={120}
            fill="#00C49F"
            dataKey="totalFinal"
            nameKey="nombre"
            label={({ nombre, percent }) => `${nombre}: ${(percent * 100).toFixed(0)}%`}
          >
            {datosPorSede.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => [`S/.${Number(value).toFixed(2)}`, 'Total']}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
    
    {/* Datos de Sedes */}
    <div className="lg:w-1/2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datosPorSede.map((sede) => (
          <div key={sede.nombre} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <div 
              className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"
              style={{ backgroundColor: `${sede.color}20`, borderColor: sede.color }}
            >
              <h4 className="font-medium text-gray-800 flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: sede.color }}
                />
                <span className="truncate">{sede.nombre}</span>
              </h4>
              <span className="text-xs font-mono bg-white px-2 py-1 rounded">
                {sede.cantidadEmpleados} {sede.cantidadEmpleados === 1 ? 'empleado' : 'empleados'}
              </span>
            </div>
            
            <div className="px-4 py-2 space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Sueldos:</span>
                <span className="font-mono text-green-600">
                  S/.{sede.totalSueldos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Descuentos:</span>
                <span className="font-mono text-red-500">
                  S/.{sede.totalDescuentos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Bonos:</span>
                <span className="font-mono text-blue-500">
                  S/.{sede.totalBonos.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm font-medium pt-1 mt-1 border-t border-gray-100">
                <span className="text-gray-700">Total:</span>
                <span className="font-mono text-teal-600">
                  S/.{sede.totalFinal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-700">Total General:</span>
          <span className="font-mono font-bold text-lg text-teal-600">
            S/.{datosPorSede.reduce((sum, item) => sum + item.totalFinal, 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  </div>
</div>

{/* Resumen por Sede y Banco */}
<div className="bg-white p-6 rounded-xl shadow-md">
  <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
    <BarChart2 className="text-blue-500" size={20} />
    Resumen por Sede y Banco
  </h3>
  <div className="space-y-6">
    {datosPorSedeYBanco.map(({ sede, bancos }) => (
      <div key={sede} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium text-gray-700 mb-3">{sede}</h4>
        <table className="w-full text-sm border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border border-gray-200 text-left">Banco</th>
              <th className="px-4 py-2 border border-gray-200 text-right">Total</th>
              <th className="px-4 py-2 border border-gray-200 text-right">Porcentaje</th>
            </tr>
          </thead>
          <tbody>
            {bancos.map(({ banco, total, porcentaje }) => (
              <tr key={banco}>
                <td className="px-4 py-2 border border-gray-200">{banco}</td>
                <td className="px-4 py-2 border border-gray-200 text-right">S/.{total.toFixed(2)}</td>
                <td className="px-4 py-2 border border-gray-200 text-right">{porcentaje.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ))}
  </div>
</div>

              {/* Opcional: Mostrar por reporte si hay más de uno */}
              {filterReporte === 'TODOS' && datosPorReporte.length > 1 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">Desglose por Reporte</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left border-b border-gray-200 font-medium text-gray-700">Reporte</th>
                          <th className="px-4 py-2 text-right border-b border-gray-200 font-medium text-gray-700">Total Sueldo</th>
                          <th className="px-4 py-2 text-right border-b border-gray-200 font-medium text-gray-700">Empleados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datosPorReporte.map((reporte) => (
                          <tr key={reporte.name} className="hover:bg-gray-50">
                            <td className="px-4 py-2 border-b border-gray-200">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: reporte.color }}
                                />
                                {reporte.name}
                              </div>
                            </td>
                            <td className="px-4 py-2 border-b border-gray-200 text-right font-mono">
                              S/.{reporte.value.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 border-b border-gray-200 text-right font-mono">
                              {reporte.empleados}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Leyenda de archivos cargados */}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileUp className="text-blue-500" size={20} />
                  Archivos Cargados ({archivosCargados.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archivosCargados.map((archivo, index) => {
                    const nombreReporte = extraerNombreReporte(archivo);
                    const reportIndex = reportesDisponibles.slice(1).indexOf(nombreReporte);
                    const color = COLORS[reportIndex % COLORS.length];
                    
                    return (
                      <div 
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{archivo}</p>
                          <p className="text-xs text-gray-500 truncate">Reporte: {nombreReporte}</p>
                        </div>
                        <button 
                          onClick={() => handleRemoveFile(archivo)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                          title="Eliminar archivo"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AttendanceManagement;