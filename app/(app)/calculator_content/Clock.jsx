import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';

export default function Clock({ style }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n) => n.toString().padStart(2, '0');
  const timeString = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  return <Text style={[styles.clock, style]}>{timeString}</Text>;
}

const styles = StyleSheet.create({
  clock: {
    fontSize: 24,
  },
});
