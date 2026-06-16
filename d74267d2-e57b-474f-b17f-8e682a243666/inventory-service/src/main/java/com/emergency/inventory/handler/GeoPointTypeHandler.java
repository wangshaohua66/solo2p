package com.emergency.inventory.handler;

import net.postgis.jdbc.PGgeometry;
import net.postgis.jdbc.geometry.Point;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.*;

public class GeoPointTypeHandler extends BaseTypeHandler<com.emergency.common.dto.GeoPoint> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, com.emergency.common.dto.GeoPoint parameter, JdbcType jdbcType) throws SQLException {
        Point point = new Point(parameter.getLng(), parameter.getLat());
        point.setSrid(4326);
        ps.setObject(i, new PGgeometry(point));
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(ResultSet rs, String columnName) throws SQLException {
        PGgeometry geometry = (PGgeometry) rs.getObject(columnName);
        return geometry != null ? com.emergency.common.dto.GeoPoint.builder()
                .lng(((Point) geometry.getGeometry()).getX())
                .lat(((Point) geometry.getGeometry()).getY())
                .build() : null;
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return getNullableResult(rs, rs.getMetaData().getColumnName(columnIndex));
    }

    @Override
    public com.emergency.common.dto.GeoPoint getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return getNullableResult(cs.getResultSet(), columnIndex);
    }
}
