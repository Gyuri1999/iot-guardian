// IoT Guardian — γέφυρα από τις εντολές του παιχνιδιού στις αληθινές βιβλιοθήκες του ESP32.
// Ο ίδιος κώδικας που τρέχει στην προσομοίωση γίνεται compile εδώ για αληθινή πλακέτα.
// Το guardian_secrets.h το γράφει ο τοπικός βοηθός από το secrets.json (δεν ανεβαίνει πουθενά).
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <esp_sleep.h>
#include "guardian_secrets.h"

// ---- ακίδες, όπως στο παιχνίδι
#define LED_PIN 2
#define BUTTON_PIN 15
#define PIR_PIN 4
#define TRIG_PIN 5
#define ECHO_PIN 18
#define RED_PIN 25
#define YELLOW_PIN 26
#define GREEN_PIN 27

// ---- αισθητήρας DHT
static DHT guardianDht(GUARDIAN_DHT_PIN, GUARDIAN_DHT_TYPE);
static bool guardianDhtStarted = false;
inline void guardianDhtBegin() { if (!guardianDhtStarted) { guardianDht.begin(); guardianDhtStarted = true; } }
inline float readTemperature() { guardianDhtBegin(); return guardianDht.readTemperature(); }
inline float readHumidity() { guardianDhtBegin(); return guardianDht.readHumidity(); }

// ---- βοηθητικές συναρτήσεις του παιχνιδιού
inline int toInt(const String &s) { return s.toInt(); }
inline float toFloat(const String &s) { return s.toFloat(); }

inline bool jsonValid(const String &s) {
  JsonDocument d;
  return !deserializeJson(d, s) && d.is<JsonObject>();
}
inline bool jsonHas(const String &s, const String &k) {
  JsonDocument d;
  if (deserializeJson(d, s) || !d.is<JsonObject>()) return false;
  return d[k].is<JsonVariantConst>() && !d[k].isNull();
}
inline String jsonGet(const String &s, const String &k) {
  JsonDocument d;
  if (deserializeJson(d, s) || !d.is<JsonObject>()) return "";
  JsonVariant v = d[k];
  if (v.isNull() || v.is<JsonObject>() || v.is<JsonArray>()) return "";
  if (v.is<bool>()) return v.as<bool>() ? "true" : "false";
  if (v.is<long>()) return String(v.as<long>());
  if (v.is<double>()) { String t; serializeJson(v, t); return t; }
  return v.as<String>();
}

// ---- WiFi: δέχεται String και επιστρέφει τη διεύθυνση ως κείμενο
inline void guardianWiFiBegin(const String &ssid, const String &pass) { WiFi.mode(WIFI_STA); WiFi.begin(ssid.c_str(), pass.c_str()); }
inline String guardianLocalIP() { return WiFi.localIP().toString(); }

// ---- MQTT με την απλή διεπαφή του παιχνιδιού (mqtt.read / mqtt.topic / mqtt.payload)
class GuardianMqtt {
 public:
  GuardianMqtt() : client_(plain_) {}

  void setServer(const String &host, int port) {
    host_ = host;
    port_ = port;
    client_.setServer(host_.c_str(), port_);
  }
  void setCACert(const char *pem) { secure_.setCACert(pem); useTls(); }
  void setInsecure() { secure_.setInsecure(); useTls(); }

  bool connect(const String &id) { return finish(client_.connect(id.c_str())); }
  bool connect(const String &id, const String &user, const String &pass) { return finish(client_.connect(id.c_str(), user.c_str(), pass.c_str())); }
  bool connected() { client_.loop(); return client_.connected(); }
  void disconnect() { client_.disconnect(); }

  template <typename T>
  bool publish(const String &topic, const T &payload, bool retained = false) {
    client_.loop();
    String p = String(payload);
    return client_.publish(topic.c_str(), (const uint8_t *)p.c_str(), p.length(), retained);
  }
  bool subscribe(const String &filter) { return client_.subscribe(filter.c_str()); }

  // Παίρνει το επόμενο μήνυμα από την ουρά. Επιστρέφει false αν δεν υπάρχει.
  bool read() {
    client_.loop();
    if (count_ == 0) return false;
    topic_ = qTopic_[head_];
    payload_ = qPayload_[head_];
    head_ = (head_ + 1) % QSIZE;
    count_--;
    return true;
  }
  String topic() { return topic_; }
  String payload() { return payload_; }

  void pump() { client_.loop(); }

 private:
  static const int QSIZE = 8;
  WiFiClient plain_;
  WiFiClientSecure secure_;
  PubSubClient client_;
  String host_;
  int port_ = 1883;
  String qTopic_[QSIZE], qPayload_[QSIZE], topic_, payload_;
  int head_ = 0, count_ = 0;

  void useTls() { client_.setClient(secure_); if (host_.length()) client_.setServer(host_.c_str(), port_); }
  bool finish(bool ok) {
    if (ok) client_.setCallback([this](char *t, uint8_t *p, unsigned int n) { push(t, p, n); });
    return ok;
  }
  void push(char *t, uint8_t *p, unsigned int n) {
    if (count_ == QSIZE) { head_ = (head_ + 1) % QSIZE; count_--; }  // γεμάτη ουρά: πετάμε το παλαιότερο
    int i = (head_ + count_) % QSIZE;
    qTopic_[i] = String(t);
    qPayload_[i] = "";
    for (unsigned int k = 0; k < n; k++) qPayload_[i] += (char)p[k];
    count_++;
  }
};
static GuardianMqtt mqtt;

// Το delay του παιχνιδιού αφήνει τον MQTT client να δουλεύει, ώστε να φτάνουν μηνύματα όσο περιμένουμε.
inline void guardianDelay(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) { mqtt.pump(); ::delay(ms - (millis() - start) > 10 ? 10 : ms - (millis() - start)); }
}
#define delay(ms) guardianDelay(ms)

// ---- ύπνος: το παιχνίδι δίνει τον αριθμό του pin ως int
inline esp_err_t esp_sleep_enable_ext0_wakeup(int pin, int level) { return esp_sleep_enable_ext0_wakeup((gpio_num_t)pin, level); }
