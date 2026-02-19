
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Alert,
  RefreshControl, TouchableOpacity // Removed Button
} from 'react-native';
import DateTimePicker from 'react-native-ui-datepicker';
import dayjs from 'dayjs';
import { api } from '../utils/api';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons'; // Ensure Ionicons is imported

const ChartsScreen = () => {
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validDates, setValidDates] = useState([]);
  const [datesLoaded, setDatesLoaded] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Fetch recent chart with debug logging
  const fetchRecentChart = useCallback(async () => {
    setLoading(true);
    try {
      const chartData = await api.getRecentBillboardChart();
      console.log('Recent chart data:', chartData);
      setChart(chartData);
    } catch (error) {
      console.error('Failed to fetch recent chart:', error);
      Alert.alert('Error', 'Failed to fetch the most recent chart: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch valid dates for calendar selection
  const fetchValidDates = useCallback(async () => {
    try {
      const dates = await api.getValidBillboardDates();
      console.log('Valid chart dates:', dates);
      setValidDates(dates);
      setDatesLoaded(true);
    } catch (error) {
      console.error('Failed to fetch valid dates:', error);
      Alert.alert('Error', 'Could not load valid chart dates: ' + error.message);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    fetchValidDates();
    fetchRecentChart();
  }, [fetchValidDates, fetchRecentChart]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRecentChart();
  }, [fetchRecentChart]);

  // Find closest valid date <= input
  const findClosestValidDate = useCallback(
    (inputDate) => {
      if (!validDates.length) return null;
      const inputTime = inputDate.getTime();
      let closestDate = null;
      let minDiff = Infinity;

      for (const dateStr of validDates) {
        const dateTime = new Date(dateStr).getTime();
        if (dateTime <= inputTime) {
          const diff = inputTime - dateTime;
          if (diff < minDiff) {
            minDiff = diff;
            closestDate = dateStr;
          }
        }
      }
      return closestDate;
    },
    [validDates]
  );

  // Fetch chart by date with error handling
  const fetchChartByDate = useCallback(
    async (dateStr) => {
      setLoading(true);
      setShowCalendar(false);
      try {
        const chartData = await api.getSpecificBillboardChart(dateStr);
        console.log(`Chart for ${dateStr}:`, chartData);
        setChart(chartData);
      } catch (error) {
        console.error(`Failed to fetch chart for ${dateStr}:`, error);
        Alert.alert('Error', `Failed to fetch chart for ${dateStr}: ${error.message}`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Handle date selected from calendar
  const handleDateChange = (params) => {
    setShowCalendar(false);
    const selectedDate = params.date;
    const closestDate = findClosestValidDate(selectedDate);
    if (closestDate) {
      if (closestDate !== dayjs(selectedDate).format('YYYY-MM-DD')) {
        Alert.alert(
          'Notice',
          `Chart not found for selected date. Showing closest available chart for ${closestDate}.`
        );
      }
      fetchChartByDate(closestDate);
    } else {
      Alert.alert('Chart Not Found', 'No charts available on or before the selected date.');
    }
  };

  // Minimal item renderer with safe guards
  const renderSongItem = ({ item, index }) => {
    if (!item) return null;
    return (
      <TouchableOpacity style={styles.songItem}>
        <Text style={styles.position}>{item.this_week || index + 1}.</Text>
        <View style={styles.songDetails}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {item.song || 'Unknown Song'}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {item.artist || 'Unknown Artist'}
          </Text>
        </View>
        <View style={styles.chartInfo}>
          <Text style={styles.chartStat}>LW: {item.last_week || 'New'}</Text>
          <Text style={styles.chartStat}>Peak: {item.peak_position || '-'}</Text>
          <Text style={styles.chartStat}>WOC: {item.weeks_on_chart || '-'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    // FIX START: Removed SafeAreaView wrapper, rely on App.js sceneContainerStyle padding
    <View style={styles.container}> 
      <Text style={styles.title}>Billboard Hot 100</Text>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, (loading || !datesLoaded) && styles.disabledButton]}
          onPress={() => setShowCalendar((prev) => !prev)}
          disabled={loading || !datesLoaded}
        >
          <Text style={styles.buttonText}>{showCalendar ? 'Hide Calendar' : 'Select Chart Date'}</Text>
        </TouchableOpacity>
      </View>

      {showCalendar && (
        <View style={styles.calendarContainer}>
          <DateTimePicker
            mode="single"
            onChange={handleDateChange}
            maxDate={dayjs().endOf('day')}
            calendarContainerStyle={styles.calendarInnerContainer}
            headerContainerStyle={styles.calendarHeader}
            weekdaysContainerStyle={styles.calendarWeekdays}
            dayContainerStyle={styles.calendarDayContainer}
            textColor={COLORS.textPrimary}
            selectedItemColor={COLORS.accent}
            selectedTextColor={COLORS.textPrimary}
            textStyle={styles.calendarText}
            todayContainerStyle={styles.calendarTodayContainer}
            iconColor={COLORS.textPrimary}
            arrowColor={COLORS.textPrimary}
            monthYearContainerStyle={styles.calendarMonthYearContainer}
            titleContainerStyle={styles.calendarTitleContainer}
            titleStyle={styles.calendarTitleText}
          />
        </View>
      )}

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={COLORS.textPrimary} style={styles.loader} />
      ) : chart && Array.isArray(chart.data) && chart.data.length > 0 ? (
        <>
          <Text style={styles.chartDate}>Chart for Week of {chart.date || 'Unknown Date'}</Text>
          <FlatList
            data={chart.data}
            renderItem={renderSongItem}
            keyExtractor={(item, index) =>
              `${chart.date || 'date'}-${item.song || 'song'}-${item.artist || 'artist'}-${index}`
            }
            style={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.textPrimary]}
                tintColor={COLORS.textPrimary}
              />
            }
          />
        </>
      ) : (
        <Text style={styles.noDataText}>No chart data to display.</Text>
      )}
    </View>
    // FIX END
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // FIX: Removed hardcoded paddingTop: 60. Now relies on App.js sceneContainerStyle
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
    color: COLORS.textPrimary,
  },
  controls: {
    paddingHorizontal: 20,
    marginBottom: 15,
    zIndex: 10,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  calendarContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 10,
    elevation: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  calendarInnerContainer: {
    backgroundColor: COLORS.primary,
  },
  calendarHeader: {
    backgroundColor: COLORS.primary,
  },
  calendarMonthYearContainer: {
    backgroundColor: COLORS.primary,
  },
  calendarTitleContainer: {
    backgroundColor: COLORS.primary,
  },
  calendarTitleText: {
    color: COLORS.textPrimary,
  },
  calendarText: {
    color: COLORS.textPrimary,
  },
  calendarWeekdays: {
    backgroundColor: COLORS.primary,
  },
  calendarDayContainer: {
    backgroundColor: COLORS.primary,
  },
  calendarTodayContainer: {
    backgroundColor: COLORS.accent + '33',
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  chartDate: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    color: COLORS.textPrimary,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    width: '100%',
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  position: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.inactive,
    width: 40,
  },
  songDetails: {
    flex: 1,
    marginLeft: 10,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  artistName: {
    fontSize: 14,
    color: COLORS.inactive,
    marginTop: 2,
  },
  chartInfo: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  chartStat: {
    fontSize: 12,
    color: COLORS.inactive,
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: COLORS.inactive,
  },
});

export default ChartsScreen;
