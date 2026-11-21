//! IoT Guardian: κοινός κώδικας για υπολογιστή (main.rs) και κινητό (Android).
//! Το παιχνίδι είναι στατικό HTML/CSS/JS: το Tauri το ανοίγει στο WebView του
//! συστήματος, χωρίς server και χωρίς internet. Η πρόοδος μένει στη συσκευή.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("δεν άνοιξε το παράθυρο του IoT Guardian");
}
