import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/history_item.dart';

/// Lightweight service managing local history on device via SharedPreferences.
/// Preserves at most 50 recent items (FIFO: drops oldest when reaching 51).
/// No network calls; strictly offline storage for privacy.
class HistoryService {
  static const String _storageKey = 'dalili_history_records_v1';
  static const int maxHistoryCount = 50;

  final SharedPreferences? _prefs;

  HistoryService({SharedPreferences? prefs}) : _prefs = prefs;

  Future<SharedPreferences> _getPrefs() async {
    return _prefs ?? await SharedPreferences.getInstance();
  }

  /// Retrieves list of saved items, ordered newest first.
  Future<List<HistoryItem>> getHistory() async {
    try {
      final prefs = await _getPrefs();
      final rawList = prefs.getStringList(_storageKey);
      if (rawList == null || rawList.isEmpty) {
        return [];
      }

      final items = <HistoryItem>[];
      for (final rawJson in rawList) {
        try {
          final decoded = jsonDecode(rawJson) as Map<String, dynamic>;
          items.add(HistoryItem.fromJson(decoded));
        } catch (e) {
          debugPrint('[HistoryService] Failed to parse item: $e');
        }
      }

      // Sort newest first by timestamp
      items.sort((a, b) => b.timestamp.compareTo(a.timestamp));
      return items;
    } catch (e) {
      debugPrint('[HistoryService] Error loading history: $e');
      return [];
    }
  }

  /// Saves a new item to local history.
  /// Automatically retains only the most recent [maxHistoryCount] items.
  Future<void> saveItem(HistoryItem item) async {
    try {
      final items = await getHistory();

      // Remove existing item with same id if already present
      items.removeWhere((existing) => existing.id == item.id);

      // Insert newest at beginning
      items.insert(0, item);

      // Keep only last 50 items
      final trimmed = items.take(maxHistoryCount).toList();

      final prefs = await _getPrefs();
      final stringList = trimmed.map((e) => jsonEncode(e.toJson())).toList();
      await prefs.setStringList(_storageKey, stringList);
    } catch (e) {
      debugPrint('[HistoryService] Error saving history item: $e');
    }
  }

  /// Deletes a single item by id.
  Future<void> deleteItem(String id) async {
    try {
      final items = await getHistory();
      items.removeWhere((item) => item.id == id);

      final prefs = await _getPrefs();
      final stringList = items.map((e) => jsonEncode(e.toJson())).toList();
      await prefs.setStringList(_storageKey, stringList);
    } catch (e) {
      debugPrint('[HistoryService] Error deleting history item: $e');
    }
  }

  /// Deletes all history items.
  Future<void> clearHistory() async {
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_storageKey);
    } catch (e) {
      debugPrint('[HistoryService] Error clearing history: $e');
    }
  }
}
